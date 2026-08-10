import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import { user } from "@rently/db/schema/auth";
import { tenantDocuments, tenantProfiles } from "@rently/db/schema/schema";
import { inArray } from "drizzle-orm";
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
});
