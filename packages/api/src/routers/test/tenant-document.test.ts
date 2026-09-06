import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import { user } from "@rently/db/schema/auth";
import { tenantDocuments, tenantProfiles } from "@rently/db/schema/schema";
import { eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
	storage: {
		createUploadUrl: vi.fn(),
		headObject: vi.fn(),
		createDownloadUrl: vi.fn(),
		deleteObject: vi.fn(),
	},
}));

vi.mock("@rently/auth", () => ({
	auth: { api: { getSession: mocks.getSession } },
}));

vi.mock("../../modules/tenant-documents/storage", () => ({
	createR2TenantDocumentStorage: () => mocks.storage,
}));

import { tenantDocument } from "../rent/tenant-document";

const db = createDb();
const createdUserIds: string[] = [];
const createdProfileIds: string[] = [];
const createdDocumentIds: string[] = [];

async function createUser(role: "owner" | "tenant", name: string) {
	const id = crypto.randomUUID();
	createdUserIds.push(id);
	await db.insert(user).values({
		id,
		name,
		email: `${id}@test.keyhq.invalid`,
		role,
	});
	return { id, name, role };
}

async function createTenant(ownerId: string) {
	const tenant = await createUser("tenant", "Tenant A");
	const id = crypto.randomUUID();
	createdProfileIds.push(id);
	await db.insert(tenantProfiles).values({
		id,
		userId: tenant.id,
		createdById: ownerId,
	});
	return tenant;
}

async function createProfile(tenantId: string, ownerId: string) {
	const id = crypto.randomUUID();
	createdProfileIds.push(id);
	await db.insert(tenantProfiles).values({
		id,
		userId: tenantId,
		createdById: ownerId,
	});
	return id;
}

async function createDocument(profileId: string, ownerId: string) {
	const id = crypto.randomUUID();
	createdDocumentIds.push(id);
	await db.insert(tenantDocuments).values({
		id,
		tenantProfileId: profileId,
		ownerId,
		documentType: "pan",
		version: 1,
		status: "upload_pending",
		storageKey: `tenant-documents/test/${id}`,
		contentType: "application/pdf",
		sizeBytes: 100,
		submissionSource: "tenant",
		submittedById: ownerId,
		uploadExpiresAt: new Date(Date.now() + 600_000),
	});
	return id;
}

function clientFor(authUser: { id: string; role: "owner" | "tenant" }) {
	mocks.getSession.mockResolvedValue({
		user: authUser,
		session: { id: "test-session" },
	});
	return createRouterClient(tenantDocument, {
		context: { db, headers: new Headers() },
	});
}

afterEach(async () => {
	if (createdDocumentIds.length > 0)
		await db
			.delete(tenantDocuments)
			.where(inArray(tenantDocuments.id, createdDocumentIds));
	if (createdProfileIds.length > 0)
		await db
			.delete(tenantProfiles)
			.where(inArray(tenantProfiles.id, createdProfileIds));
	if (createdUserIds.length > 0)
		await db.delete(user).where(inArray(user.id, createdUserIds));
	createdDocumentIds.length = 0;
	createdProfileIds.length = 0;
	createdUserIds.length = 0;
	mocks.getSession.mockReset();
	mocks.storage.createUploadUrl.mockReset();
});

describe("tenant document authorization", () => {
	it("keeps storage keys out of upload and list responses", async () => {
		const owner = await createUser("owner", "Owner A");
		const tenant = await createTenant(owner.id);
		mocks.storage.createUploadUrl.mockResolvedValueOnce({
			uploadUrl: "https://signed.invalid/upload",
			storageKey: "tenant-documents/owner/profile/document",
			expiresAt: new Date(Date.now() + 600_000),
			requiredHeaders: {
				"Content-Type": "application/pdf",
				"Content-Disposition": 'attachment; filename="pan-v1"',
				"Cache-Control": "private, no-store",
			},
		});

		const tenantResult = await clientFor(tenant).beginTenantDocumentUpload({
			documentType: "pan",
			contentType: "application/pdf",
			sizeBytes: 100,
			target: { kind: "initial" },
		});
		createdDocumentIds.push(tenantResult.documentId);
		expect(tenantResult).not.toHaveProperty("storageKey");

		const ownerResult = await clientFor(owner).listTenantDocuments({
			tenantId: tenant.id,
		});
		expect(ownerResult.documents[0]).not.toHaveProperty("storageKey");
		expect(ownerResult.documents[0]?.status).toBe("upload_pending");
	});

	it("returns NOT_FOUND for another owner's tenant", async () => {
		const owner = await createUser("owner", "Owner A");
		const otherOwner = await createUser("owner", "Owner B");
		const tenant = await createTenant(owner.id);

		await expect(
			clientFor(otherOwner).listTenantDocuments({ tenantId: tenant.id }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("does not allow owners to use tenant-only procedures", async () => {
		const owner = await createUser("owner", "Owner A");

		await expect(clientFor(owner).listMyDocuments()).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
	});

	it("scopes a shared tenant's documents to each owner's own relationship", async () => {
		// E02: one tenant, one profile per owner. Neither owner may see,
		// list, or download through the other's relationship; the tenant
		// resolves one explicit relationship at a time.
		const ownerA = await createUser("owner", "Owner A");
		const ownerB = await createUser("owner", "Owner B");
		const tenant = await createUser("tenant", "Tenant A");
		const profileA = await createProfile(tenant.id, ownerA.id);
		const profileB = await createProfile(tenant.id, ownerB.id);
		const docA = await createDocument(profileA, ownerA.id);
		const docB = await createDocument(profileB, ownerB.id);

		const listA = await clientFor(ownerA).listTenantDocuments({
			tenantId: tenant.id,
		});
		const listB = await clientFor(ownerB).listTenantDocuments({
			tenantId: tenant.id,
		});
		expect(listA.documents.map((doc) => doc.id)).toEqual([docA]);
		expect(listB.documents.map((doc) => doc.id)).toEqual([docB]);

		await expect(
			clientFor(ownerA).getPrivateDocumentDownloadUrl({
				documentId: docB,
			}),
		).rejects.toMatchObject({ code: "NOT_FOUND" });

		// Tenant default resolves the earliest live relationship
		// deterministically; ownerId selects the other one explicitly.
		const mineDefault = await clientFor(tenant).listMyDocuments();
		expect(mineDefault.documents.map((doc) => doc.id)).toEqual([docA]);
		const mineB = await clientFor(tenant).listMyDocuments({
			ownerId: ownerB.id,
		});
		expect(mineB.documents.map((doc) => doc.id)).toEqual([docB]);
	});

	it("blocks new uploads on removed relationships but retains reads", async () => {
		// E02 retained-document access: soft-deleting the owner-scoped
		// profile (removeTenant) ends new activity on that relationship,
		// while the owner keeps read-only access to attached documents.
		const owner = await createUser("owner", "Owner A");
		const tenant = await createTenant(owner.id);
		const [profile] = await db
			.select({ id: tenantProfiles.id })
			.from(tenantProfiles)
			.where(eq(tenantProfiles.userId, tenant.id));
		if (!profile) throw new Error("Tenant profile was not created");
		const documentId = await createDocument(profile.id, owner.id);

		await db
			.update(tenantProfiles)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(eq(tenantProfiles.id, profile.id));

		await expect(
			clientFor(tenant).beginTenantDocumentUpload({
				documentType: "pan",
				contentType: "application/pdf",
				sizeBytes: 100,
				target: { kind: "initial" },
				ownerId: owner.id,
			}),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(
			clientFor(owner).beginTenantDocumentUpload({
				tenantId: tenant.id,
				documentType: "pan",
				contentType: "application/pdf",
				sizeBytes: 100,
				target: { kind: "initial" },
			}),
		).rejects.toMatchObject({ code: "NOT_FOUND" });

		const retained = await clientFor(owner).listTenantDocuments({
			tenantId: tenant.id,
		});
		expect(retained.documents.map((doc) => doc.id)).toEqual([documentId]);

		mocks.storage.headObject.mockResolvedValueOnce({});
		mocks.storage.createDownloadUrl.mockResolvedValueOnce(
			"https://signed.invalid/download",
		);
		const download = await clientFor(owner).getPrivateDocumentDownloadUrl({
			documentId,
		});
		expect(download.downloadUrl).toBe("https://signed.invalid/download");
	});

	it("rejects Aadhaar uploads while they are disabled", async () => {
		const owner = await createUser("owner", "Owner A");
		const tenant = await createTenant(owner.id);

		await expect(
			clientFor(tenant).beginTenantDocumentUpload({
				documentType: "aadhaar",
				contentType: "application/pdf",
				sizeBytes: 100,
				target: { kind: "initial" },
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: "AADHAAR_UPLOAD_DISABLED",
		});
	});
});
