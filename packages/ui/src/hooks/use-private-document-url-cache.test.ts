// H06 regression rationale: preview object URLs are per-session bytes kept
// in a module-level Map nobody cleared — logout never revoked them, closing
// a viewer kept them, and entries lived for the tab lifetime. A second user
// signing in on the same tab (no reload between sessions) would be served
// the previous session's bytes for the same document id. These tests pin the
// lifecycle: session-end clearing, per-viewer revocation, and a TTL bound so
// stale blobs refetch instead of lingering.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	clearPreviewCache,
	PREVIEW_URL_TTL_MS,
	revokePreviewUrl,
	usePrivateDocumentUrlCache,
} from "./use-private-document-url-cache";

const createdUrls: string[] = [];
const revokedUrls: string[] = [];
let blobSeq = 0;

function loaderFor(signedUrl: string) {
	return async () => signedUrl;
}

beforeEach(() => {
	blobSeq = 0;
	vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
		blobSeq += 1;
		const url = `blob:preview-${blobSeq}`;
		createdUrls.push(url);
		return url;
	});
	vi.spyOn(URL, "revokeObjectURL").mockImplementation((url: string) => {
		revokedUrls.push(url);
	});
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => ({
			ok: true,
			blob: async () => ({}),
		})),
	);
});

afterEach(() => {
	clearPreviewCache();
	createdUrls.length = 0;
	revokedUrls.length = 0;
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

function testCache() {
	// biome-ignore lint/correctness/useHookAtTopLevel: test-only stateless-hook accessor.
	return usePrivateDocumentUrlCache();
}

async function loadTwice(
	documentId: string,
	loader = loaderFor("https://signed/a"),
) {
	const cache = testCache();
	const first = await cache.getPreviewUrl(documentId, loader);
	const second = await cache.getPreviewUrl(documentId, loader);
	return { first, second };
}

// A fetch stub that stays pending until release() — the module fetches the
// signed URL after the loader resolves, so gating fetch holds the load.
function gateFetch() {
	let release!: (value: { ok: boolean; blob: () => Promise<unknown> }) => void;
	const gate = new Promise<{ ok: boolean; blob: () => Promise<unknown> }>(
		(resolve) => {
			release = resolve;
		},
	);
	const fetchImpl = vi.fn(() => gate);
	return {
		fetchImpl,
		release() {
			release({ ok: true, blob: async () => ({}) });
		},
	};
}

describe("private document preview cache lifecycle (H06)", () => {
	it("serves the cached URL while fresh", async () => {
		const loader = vi.fn(loaderFor("https://signed/a"));
		const { first, second } = await loadTwice("doc-1", loader);
		expect(first).toBe(second);
		expect(loader).toHaveBeenCalledTimes(1);
	});

	it("deduplicates concurrent loads of the same document", async () => {
		const loader = vi.fn(loaderFor("https://signed/a"));
		const cache = testCache();
		const [first, second] = await Promise.all([
			cache.getPreviewUrl("doc-1", loader),
			cache.getPreviewUrl("doc-1", loader),
		]);
		expect(first).toBe(second);
		expect(loader).toHaveBeenCalledTimes(1);
	});

	it("retries after a failed load instead of caching the failure", async () => {
		const cache = testCache();
		await expect(
			cache.getPreviewUrl("doc-1", async () => {
				throw new Error("signed url expired");
			}),
		).rejects.toThrow("signed url expired");
		const url = await cache.getPreviewUrl(
			"doc-1",
			loaderFor("https://signed/b"),
		);
		expect(url).toBe("blob:preview-1");
	});

	it("logout clears the cache so the next session refetches", async () => {
		const cache = testCache();
		const beforeLogout = await cache.getPreviewUrl(
			"doc-1",
			loaderFor("https://signed/a"),
		);
		// Logout ends the session: every cached blob is revoked and dropped.
		clearPreviewCache();
		expect(revokedUrls).toContain(beforeLogout);
		// Same tab, new login: nothing of the previous session may be served.
		const loader = vi.fn(loaderFor("https://signed/a"));
		const afterLogin = await cache.getPreviewUrl("doc-1", loader);
		expect(loader).toHaveBeenCalledTimes(1);
		expect(afterLogin).not.toBe(beforeLogout);
	});

	it("revokes only the closed viewer's document", async () => {
		const cache = testCache();
		const first = await cache.getPreviewUrl(
			"doc-1",
			loaderFor("https://signed/a"),
		);
		const second = await cache.getPreviewUrl(
			"doc-2",
			loaderFor("https://signed/b"),
		);
		revokePreviewUrl("doc-1");
		expect(revokedUrls).toEqual([first]);
		// The other document stays cached — no refetch.
		const loader = vi.fn(loaderFor("https://signed/b"));
		await expect(cache.getPreviewUrl("doc-2", loader)).resolves.toBe(second);
		expect(loader).not.toHaveBeenCalled();
	});

	it("refetches after the TTL without revoking the possibly-displayed URL", async () => {
		const cache = testCache();
		const now = Date.now();
		const nowSpy = vi.spyOn(Date, "now").mockReturnValue(now);
		const first = await cache.getPreviewUrl(
			"doc-1",
			loaderFor("https://signed/a"),
		);
		// Still fresh just before the TTL.
		nowSpy.mockReturnValue(now + PREVIEW_URL_TTL_MS - 1);
		const loader = vi.fn(loaderFor("https://signed/a"));
		await expect(cache.getPreviewUrl("doc-1", loader)).resolves.toBe(first);
		expect(loader).not.toHaveBeenCalled();
		// Past the TTL the entry is dropped and refetched — but the old blob is
		// not revoked here: it may still be displayed by an open viewer, whose
		// close path owns revocation.
		nowSpy.mockReturnValue(now + PREVIEW_URL_TTL_MS + 1);
		const refetchLoader = vi.fn(loaderFor("https://signed/a2"));
		const second = await cache.getPreviewUrl("doc-1", refetchLoader);
		expect(refetchLoader).toHaveBeenCalledTimes(1);
		expect(second).not.toBe(first);
		expect(revokedUrls).not.toContain(first);
	});

	it("drops a late completion when the viewer closed mid-load", async () => {
		const gate = gateFetch();
		vi.stubGlobal("fetch", gate.fetchImpl);
		const cache = testCache();
		const pending = cache.getPreviewUrl("doc-1", loaderFor("https://signed/a"));
		// Viewer closes while the fetch is in flight.
		revokePreviewUrl("doc-1");
		gate.release();
		const url = await pending;
		// The bytes arrived too late: revoked immediately, never cached.
		expect(revokedUrls).toContain(url);
		const reload = vi.fn(loaderFor("https://signed/a"));
		await expect(cache.getPreviewUrl("doc-1", reload)).resolves.not.toBe(url);
		expect(reload).toHaveBeenCalledTimes(1);
	});

	it("drops a late completion across a logout", async () => {
		const gate = gateFetch();
		vi.stubGlobal("fetch", gate.fetchImpl);
		const cache = testCache();
		const pending = cache.getPreviewUrl("doc-1", loaderFor("https://signed/a"));
		// Logout while the fetch is in flight.
		clearPreviewCache();
		gate.release();
		const url = await pending;
		expect(revokedUrls).toContain(url);
		// Same tab, new login: the previous session's bytes are gone.
		const reload = vi.fn(loaderFor("https://signed/a"));
		await expect(cache.getPreviewUrl("doc-1", reload)).resolves.not.toBe(url);
		expect(reload).toHaveBeenCalledTimes(1);
	});
});
