import { describe, expect, it } from "vitest";
import {
	InMemoryTenantDocumentStorage,
	tenantDocumentStorageKey,
} from "./storage";

describe("tenant document storage", () => {
	it("generates backend-scoped keys without document metadata", () => {
		const key = tenantDocumentStorageKey({
			ownerId: "owner-id",
			tenantProfileId: "profile-id",
			documentId: "document-id",
		});

		expect(key).toBe("tenant-documents/owner-id/profile-id/document-id");
		expect(key).not.toContain("aadhaar");
		expect(key).not.toContain("pan");
		expect(key).not.toContain("@test");
	});

	it("keeps object metadata behind the storage interface", async () => {
		const storage = new InMemoryTenantDocumentStorage();
		const signed = await storage.createUploadUrl({
			ownerId: "owner-id",
			tenantProfileId: "profile-id",
			documentId: "document-id",
			documentType: "pan",
			contentType: "application/pdf",
			version: 2,
		});

		expect(signed.uploadUrl).not.toContain(signed.storageKey);
		expect(signed.requiredHeaders).toEqual({
			"Content-Type": "application/pdf",
			"Content-Disposition": 'attachment; filename="pan-v2"',
			"Cache-Control": "private, no-store",
		});

		storage.putObject({
			key: signed.storageKey,
			contentType: "application/pdf",
			body: new Uint8Array([1, 2, 3]),
		});
		expect(await storage.headObject(signed.storageKey)).toMatchObject({
			contentType: "application/pdf",
			sizeBytes: 3,
		});

		const downloadUrl = await storage.createDownloadUrl({
			key: signed.storageKey,
			documentType: "pan",
			version: 2,
			contentType: "application/pdf",
			disposition: "inline",
		});
		expect(downloadUrl).toContain("ttl=60");
		expect(downloadUrl).toContain("disposition=inline");
		await storage.deleteObject(signed.storageKey);
		expect(await storage.headObject(signed.storageKey)).toBeNull();
	});
});
