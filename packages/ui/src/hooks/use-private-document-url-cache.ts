"use client";

type PreviewLoader = () => Promise<string>;
const previewCache = new Map<string, string | Promise<string>>();

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
	};
}
