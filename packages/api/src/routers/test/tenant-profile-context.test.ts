import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import { user } from "@rently/db/schema/auth";
import { tenantProfiles } from "@rently/db/schema/schema";
import { inArray } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
}));

vi.mock("@rently/auth", () => ({
	auth: { api: { getSession: mocks.getSession } },
}));

import * as tenantPortal from "../rent/tenant-portal";

const db = createDb();
const createdUserIds: string[] = [];
const createdProfileIds: string[] = [];

async function createUser(role: "owner" | "tenant", name: string) {
	const id = crypto.randomUUID();
	createdUserIds.push(id);
	await db.insert(user).values({
		id,
		name,
		email: `${id}@test.keyhq.invalid`,
		phone: "+910000000000",
		role,
	});
	return { id, name };
}

async function createProfile(
	tenantId: string,
	ownerId: string,
	address: string,
) {
	const id = crypto.randomUUID();
	createdProfileIds.push(id);
	await db.insert(tenantProfiles).values({
		id,
		userId: tenantId,
		email: `${tenantId}@test.keyhq.invalid`,
		address,
		emergencyContactName: `Contact for ${address}`,
		createdById: ownerId,
	});
	return id;
}

function clientFor(authUser: { id: string; role: string }) {
	mocks.getSession.mockResolvedValue({
		user: authUser,
		session: { id: "test-session" },
	});
	return createRouterClient(
		{ getMyProfile: tenantPortal.getMyProfile },
		{ context: { db, headers: new Headers() } },
	);
}

afterEach(async () => {
	if (createdProfileIds.length > 0)
		await db
			.delete(tenantProfiles)
			.where(inArray(tenantProfiles.id, createdProfileIds));
	if (createdUserIds.length > 0)
		await db.delete(user).where(inArray(user.id, createdUserIds));
	createdProfileIds.length = 0;
	createdUserIds.length = 0;
	mocks.getSession.mockReset();
});

describe("E03 tenant profile context", () => {
	it("returns explicit per-owner profiles instead of one arbitrary relationship", async () => {
		const ownerA = await createUser("owner", "Owner A");
		const ownerB = await createUser("owner", "Owner B");
		const tenant = await createUser("tenant", "Shared Tenant");
		await createProfile(tenant.id, ownerA.id, "Owner A Street");
		await createProfile(tenant.id, ownerB.id, "Owner B Street");

		const result = await clientFor({
			id: tenant.id,
			role: "tenant",
		}).getMyProfile({});

		expect(result.user.name).toBe("Shared Tenant");
		expect(result.profiles).toHaveLength(2);
		const byOwner = new Map(result.profiles.map((p) => [p.ownerId, p]));
		expect(byOwner.get(ownerA.id)?.address).toBe("Owner A Street");
		expect(byOwner.get(ownerB.id)?.address).toBe("Owner B Street");
		expect(byOwner.get(ownerA.id)?.ownerName).toBe("Owner A");
		expect(byOwner.get(ownerB.id)?.ownerName).toBe("Owner B");
	});

	it("excludes soft-deleted relationships", async () => {
		const ownerA = await createUser("owner", "Owner A");
		const ownerB = await createUser("owner", "Owner B");
		const tenant = await createUser("tenant", "Shared Tenant");
		const deletedId = await createProfile(tenant.id, ownerA.id, "Old Street");
		await createProfile(tenant.id, ownerB.id, "Live Street");
		await db
			.update(tenantProfiles)
			.set({ deletedAt: new Date() })
			.where(inArray(tenantProfiles.id, [deletedId]));

		const result = await clientFor({
			id: tenant.id,
			role: "tenant",
		}).getMyProfile({});

		expect(result.profiles).toHaveLength(1);
		expect(result.profiles[0]?.ownerId).toBe(ownerB.id);
		expect(result.profiles[0]?.address).toBe("Live Street");
	});
});
