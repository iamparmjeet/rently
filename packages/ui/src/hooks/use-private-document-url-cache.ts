"use client";

type PreviewLoader = () => Promise<string>;
type CacheEntry = { url: string; at: number } | Promise<string>;

// H06: preview blobs are per-session bytes. Entries expire after this TTL so
// a later session — or a replaced document — refetches instead of reusing
// stale blobs. Viewers revoke on close; logout clears everything.
export const PREVIEW_URL_TTL_MS = 15 * 60 * 1000;

const previewCache = new Map<string, CacheEntry>();

// H06: a load that completes after its document was revoked (viewer closed,
// logout) must not re-cache — its bytes belong to a dead view or session.
// Bans are timestamped: a load that started after the ban is a legitimate
// reopen and clears it, so the map stays bounded to unrevisited documents.
const revokedAfter = new Map<string, number>();

function ban(documentId: string): void {
	revokedAfter.set(documentId, Date.now());
}

function revokeUrl(url: string): void {
	try {
		URL.revokeObjectURL(url);
	} catch {}
}

// Revoke all cached object URLs and clear map — call on logout or session
// identity change. In-flight loads are dropped, never revoked: they hold no
// URL yet, and their late completion re-caches under the new session only if
// the document is opened again.
export function clearPreviewCache(): void {
	for (const [documentId, value] of previewCache) {
		ban(documentId);
		if (!(value instanceof Promise)) revokeUrl(value.url);
	}
	previewCache.clear();
}

// Revoke one viewer's document — call when its viewer closes or unmounts.
export function revokePreviewUrl(documentId: string): void {
	ban(documentId);
	const value = previewCache.get(documentId);
	if (value && !(value instanceof Promise)) {
		revokeUrl(value.url);
	}
	previewCache.delete(documentId);
}

async function loadPreview(
	documentId: string,
	loader: PreviewLoader,
): Promise<string> {
	const cached = previewCache.get(documentId);
	const startedAt = Date.now();
	const bannedAt = revokedAfter.get(documentId);
	if (bannedAt !== undefined && bannedAt <= startedAt) {
		// A legitimate reopen after the ban — the ban has served its purpose.
		revokedAfter.delete(documentId);
	}

	if (cached) {
		if (cached instanceof Promise) return cached;
		if (Date.now() - cached.at < PREVIEW_URL_TTL_MS) return cached.url;
		// Stale: drop without revoking — the blob may still be displayed by
		// an open viewer, whose close path owns revocation.
		previewCache.delete(documentId);
	}

	const pending = loader()
		.then(async (signedUrl) => {
			const response = await fetch(signedUrl, {
				cache: "no-store",
			});

			if (!response.ok) {
				throw new Error("Could not load document preview");
			}

			const blog = await response.blob();
			const objectUrl = URL.createObjectURL(blog);
			const ban = revokedAfter.get(documentId);
			if (ban !== undefined && ban >= startedAt) {
				// Revoked or logged out while loading: the bytes belong to a
				// dead view — revoke immediately instead of caching.
				revokeUrl(objectUrl);
				return objectUrl;
			}
			revokedAfter.delete(documentId);
			previewCache.set(documentId, { url: objectUrl, at: Date.now() });

			return objectUrl;
		})
		.catch((error) => {
			previewCache.delete(documentId);
			throw error;
		});

	previewCache.set(documentId, pending);
	return pending;
}

export function usePrivateDocumentUrlCache() {
	return {
		getPreviewUrl: loadPreview,
		clearCache: clearPreviewCache,
		revokeUrl: revokePreviewUrl,
	};
}
