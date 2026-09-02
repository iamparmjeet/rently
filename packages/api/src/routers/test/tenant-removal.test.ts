import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import { user } from "@rently/db/schema/auth";
import { tenantInvites, tenantProfiles } from "@rently/db/schema/schema";
import { eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
}));

vi.mock("@rently/auth", () => ({
	auth: { api: { getSession: mocks.getSession } },
}));

vi.mock("@rently/email", () => ({
	sendCustomEmailToTenant: vi.fn(),
}));

import { listTenants, removeTenant } from "../rent/tenant";

const db = createDb();
const createdUserIds: string[] = [];
const createdInviteIds: string[] = [];
const createdProfileIds: string[] = [];

async function createOwner() {
	const id = crypto.randomUUID();
	createdUserIds.push(id);
	await db.insert(user).values({
		id,
		name: "Owner A",
		email: `${id}@test.keyhq.invalid`,
		role: "owner",
	});
	return { id, name: "Owner A", role: "owner" as const };
}

async function createOwnerPreparedTenant(ownerId: string) {
	const id = crypto.randomUUID();
	createdInviteIds.push(id);
	createdUserIds.push(id);
	createdProfileIds.push(id);
	const email = `${id}@test.keyhq.invalid`;

	await db.insert(tenantInvites).values({
		id,
		name: "Tenant A",
		email,
		token: crypto.randomUUID(),
		onboardingMode: "owner_prepared",
		invitedById: ownerId,
		status: "pending",
	});
	await db.insert(user).values({
		id,
		name: "Tenant A",
		email,
		role: "tenant",
	});
	await db.insert(tenantProfiles).values({
		id,
		userId: id,
		invitedId: id,
		createdById: ownerId,
	});

	return { id };
}

function clientFor(owner: Awaited<ReturnType<typeof createOwner>>) {
	mocks.getSession.mockResolvedValue({
		user: owner,
		session: { id: "test-session" },
	});
	return createRouterClient(
		{ listTenants, removeTenant },
		{
			context: { db, headers: new Headers() },
		},
	);
}

afterEach(async () => {
	if (createdProfileIds.length > 0) {
		await db
			.delete(tenantProfiles)
			.where(inArray(tenantProfiles.id, createdProfileIds));
	}
	if (createdInviteIds.length > 0) {
		await db
			.delete(tenantInvites)
			.where(inArray(tenantInvites.id, createdInviteIds));
	}
	if (createdUserIds.length > 0) {
		await db.delete(user).where(inArray(user.id, createdUserIds));
	}
	createdProfileIds.length = 0;
	createdInviteIds.length = 0;
	createdUserIds.length = 0;
	mocks.getSession.mockReset();
});

describe("removeTenant", () => {
	it("removes a tenant that has no active lease", async () => {
		const owner = await createOwner();
		const tenant = await createOwnerPreparedTenant(owner.id);

		const result = await clientFor(owner).removeTenant({
			tenantId: tenant.id,
		});

		expect(result).toEqual({ success: true, leasesTerminated: 0 });

		const [invite] = await db
			.select({ status: tenantInvites.status })
			.from(tenantInvites)
			.where(eq(tenantInvites.id, tenant.id));
		const [profile] = await db
			.select({ deletedAt: tenantProfiles.deletedAt })
			.from(tenantProfiles)
			.where(eq(tenantProfiles.id, tenant.id));

		expect(invite?.status).toBe("expired");
		expect(profile?.deletedAt).toBeInstanceOf(Date);
		expect((await clientFor(owner).listTenants()).tenants).not.toEqual(
			expect.arrayContaining([expect.objectContaining({ id: tenant.id })]),
		);
	});
});
