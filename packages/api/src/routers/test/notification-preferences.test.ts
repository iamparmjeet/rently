import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import { user } from "@rently/db/schema/auth";
import { notificationPreferences } from "@rently/db/schema/schema";
import { inArray } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getPreferences, updatePreferences } from "../notification";

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@rently/auth", () => ({
	auth: { api: { getSession: mocks.getSession } },
}));

const db = createDb();
const createdUserIds: string[] = [];

async function createOwner() {
	const id = crypto.randomUUID();
	const owner = {
		id,
		name: "Owner",
		email: `${id}@test.keyhq.invalid`,
		role: "owner" as const,
	};
	createdUserIds.push(id);
	await db.insert(user).values(owner);
	return owner;
}

function clientFor(owner: Awaited<ReturnType<typeof createOwner>>) {
	mocks.getSession.mockResolvedValue({
		user: owner,
		session: { id: "test-session" },
	});
	return createRouterClient(
		{ getPreferences, updatePreferences },
		{ context: { db, headers: new Headers() } },
	);
}

afterEach(async () => {
	if (createdUserIds.length) {
		await db
			.delete(notificationPreferences)
			.where(inArray(notificationPreferences.ownerId, createdUserIds));
		await db.delete(user).where(inArray(user.id, createdUserIds));
	}
	createdUserIds.length = 0;
	mocks.getSession.mockReset();
});

describe("notification preferences", () => {
	it("lazily creates conservative defaults and remains race-safe", async () => {
		const owner = await createOwner();
		const results = await Promise.all([
			clientFor(owner).getPreferences(),
			clientFor(owner).getPreferences(),
		]);
		expect(results[0]?.preferences).toMatchObject({
			paymentReceived: true,
			utilityBillGenerated: false,
			leaseExpiryAlert: true,
			rentDueReminder: true,
			overdueAlert: true,
			rentDueLeadDays: 3,
			overdueGraceDays: 2,
		});
		expect(results[1]?.preferences).toEqual(results[0]?.preferences);
	});

	it("updates the complete owner-scoped snapshot", async () => {
		const owner = await createOwner();
		const result = await clientFor(owner).updatePreferences({
			paymentReceived: false,
			utilityBillGenerated: true,
			leaseExpiryAlert: false,
			rentDueReminder: false,
			overdueAlert: true,
			rentDueLeadDays: 3,
			overdueGraceDays: 2,
		});
		expect(result.preferences).toMatchObject({
			paymentReceived: false,
			utilityBillGenerated: true,
			leaseExpiryAlert: false,
			rentDueReminder: false,
			overdueAlert: true,
			rentDueLeadDays: 3,
			overdueGraceDays: 2,
		});
	});

	it("accepts the preferences snapshot returned to the settings form", async () => {
		const owner = await createOwner();
		const current = await clientFor(owner).getPreferences();
		const { updatedAt: _updatedAt, ...editablePreferences } =
			current.preferences;

		await expect(
			clientFor(owner).updatePreferences(editablePreferences),
		).resolves.toMatchObject({ preferences: editablePreferences });
	});

	it("does not allow malformed snapshots", async () => {
		const owner = await createOwner();
		await expect(
			clientFor(owner).updatePreferences({ paymentReceived: true } as never),
		).rejects.toBeDefined();
	});

	it("isolates one owner from another", async () => {
		const owner = await createOwner();
		const other = await createOwner();
		await clientFor(owner).updatePreferences({
			paymentReceived: false,
			utilityBillGenerated: true,
			leaseExpiryAlert: false,
			rentDueReminder: false,
			overdueAlert: false,
			rentDueLeadDays: 3,
			overdueGraceDays: 2,
		});
		const otherPreferences = await clientFor(other).getPreferences();
		expect(otherPreferences.preferences.paymentReceived).toBe(true);
		expect(otherPreferences.preferences.utilityBillGenerated).toBe(false);
	});
});
