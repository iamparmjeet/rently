"use client";

type PreviewLoader = () => Promise<string>;
const previewCache = new Map<string, string | Promise<string>>();

// Revoke all cached object URLs and clear map — call on logout or viewer unmount
export function clearPreviewCache(): void {
	for (const value of previewCache.values()) {
		if (typeof value === "string") {
			try {
				URL.revokeObjectURL(value);
			} catch {}
		}
	}
	previewCache.clear();
}

export function revokePreviewUrl(documentId: string): void {
	const value = previewCache.get(documentId);
	if (typeof value === "string") {
		try {
			URL.revokeObjectURL(value);
		} catch {}
	}
	previewCache.delete(documentId);
}

async function loadPreview(
	documentId: string,
	loader: PreviewLoader,
): Promise<string> {
	const cached = previewCache.get(documentId);

	if (cached) return cached;

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
			previewCache.set(documentId, objectUrl);

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
