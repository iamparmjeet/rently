// G04 meter-reading rate-limit scoping — regression rationale:
// The tenant submit limiter counted EVERY utility bill on the tenant's
// leases in the last hour — including owner-created bills — so owner billing
// activity could lock the tenant out with TOO_MANY_REQUESTS. Bills now carry
// their submission source and the limiter counts tenant submissions only.
// Legacy/unknown rows stay NULL and fail open (never counted).
import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import {
	PROPERTY_TYPES,
	UNIT_TYPES,
} from "@rently/db/constants/rent-constants";
import { user } from "@rently/db/schema/auth";
import {
	leases,
	properties,
	tenantProfiles,
	units,
	utilities,
} from "@rently/db/schema/schema";
import { eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
}));

vi.mock("@rently/auth", () => ({
	auth: { api: { getSession: mocks.getSession } },
}));

import { submitMyReading as submitReading } from "../rent/tenant-portal";

const db = createDb();

const createdUserIds: string[] = [];
const createdProfileIds: string[] = [];
const createdPropertyIds: string[] = [];
const createdUnitIds: string[] = [];
const createdLeaseIds: string[] = [];

function daysAgoKey(days: number): string {
	return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
		.toISOString()
		.slice(0, 10);
}

async function tenantWithLeases(count: number) {
	const ownerId = crypto.randomUUID();
	createdUserIds.push(ownerId);
	await db.insert(user).values({
		id: ownerId,
		name: "Owner A",
		email: `${ownerId}@test.keyhq.invalid`,
		role: "owner",
	});
	const tenantId = crypto.randomUUID();
	createdUserIds.push(tenantId);
	await db.insert(user).values({
		id: tenantId,
		name: "Tenant A",
		email: `${tenantId}@test.keyhq.invalid`,
		role: "tenant",
	});
	const profileId = crypto.randomUUID();
	createdProfileIds.push(profileId);
	await db.insert(tenantProfiles).values({
		id: profileId,
		userId: tenantId,
		createdById: ownerId,
	});
	const propertyId = crypto.randomUUID();
	createdPropertyIds.push(propertyId);
	await db.insert(properties).values({
		id: propertyId,
		ownerId,
		name: "Palm Residency",
		address: "1 Palm Road, Mumbai",
		type: PROPERTY_TYPES.RESIDENTIAL,
	});
	const leaseIds: string[] = [];
	for (let index = 0; index < count; index += 1) {
		const unitId = crypto.randomUUID();
		createdUnitIds.push(unitId);
		await db.insert(units).values({
			id: unitId,
			propertyId,
			unitNumber: `G04-${unitId.slice(0, 4)}`,
			type: UNIT_TYPES.ONEBHK,
			baseRent: 10_000_00,
			status: "occupied",
		});
		const leaseId = crypto.randomUUID();
		createdLeaseIds.push(leaseId);
		await db.insert(leases).values({
			id: leaseId,
			unitId,
			tenantId,
			startDate: new Date("2026-01-01T00:00:00.000Z"),
			endDate: new Date("2027-01-01T00:00:00.000Z"),
			rent: 10_000_00,
			status: "active",
			rentDueDate: 10,
		});
		leaseIds.push(leaseId);
	}
	mocks.getSession.mockResolvedValue({
		user: { id: tenantId, role: "tenant" },
		session: { id: "test-session" },
	});
	const context = { db, headers: new Headers() } as never;
	return {
		api: createRouterClient({ submitReading }, { context }),
		leaseIds,
	};
}

// Owner-side billing activity: recent rows the tenant never submitted.
async function seedOwnerBills(leaseId: string, count: number) {
	for (let index = 0; index < count; index += 1) {
		await db.insert(utilities).values({
			leaseId,
			utilityType: "electricity",
			previousReading: index * 100,
			currentReading: index * 100 + 50,
			previousReadingDate: new Date("2026-05-01T00:00:00.000Z"),
			currentReadingDate: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000),
			unitsUsed: 50,
			ratePerUnit: 900,
			fixedCharge: 10000,
			totalAmount: 55000,
			isPaid: false,
		});
	}
}

afterEach(async () => {
	if (createdLeaseIds.length > 0) {
		await db
			.delete(utilities)
			.where(inArray(utilities.leaseId, createdLeaseIds));
		await db.delete(leases).where(inArray(leases.id, createdLeaseIds));
	}
	if (createdUnitIds.length > 0) {
		await db.delete(units).where(inArray(units.id, createdUnitIds));
	}
	if (createdPropertyIds.length > 0) {
		await db
			.delete(properties)
			.where(inArray(properties.id, createdPropertyIds));
	}
	if (createdProfileIds.length > 0) {
		await db
			.delete(tenantProfiles)
			.where(inArray(tenantProfiles.id, createdProfileIds));
	}
	if (createdUserIds.length > 0) {
		await db.delete(user).where(inArray(user.id, createdUserIds));
	}
	createdLeaseIds.length = 0;
	createdUnitIds.length = 0;
	createdPropertyIds.length = 0;
	createdProfileIds.length = 0;
	createdUserIds.length = 0;
	mocks.getSession.mockReset();
});

describe("G04 meter-reading rate-limit scoping", () => {
	it("ignores owner bills on the same lease", async () => {
		const { api, leaseIds } = await tenantWithLeases(1);
		const leaseId = leaseIds[0];
		if (!leaseId) throw new Error("Fixture created no lease");
		await seedOwnerBills(leaseId, 5);

		await api.submitReading({
			currentReading: 500,
			readingDate: daysAgoKey(5),
			leaseId,
		});

		const bills = await db
			.select({ id: utilities.id })
			.from(utilities)
			.where(eq(utilities.leaseId, leaseId));
		expect(bills).toHaveLength(6);
	});

	it("ignores owner bills on the tenant's other lease", async () => {
		const { api, leaseIds } = await tenantWithLeases(2);
		const [first, second] = leaseIds;
		if (!first || !second) throw new Error("Fixture created no leases");
		await seedOwnerBills(first, 5);

		await api.submitReading({
			currentReading: 150,
			readingDate: daysAgoKey(5),
			leaseId: second,
		});

		const bills = await db
			.select({ id: utilities.id })
			.from(utilities)
			.where(eq(utilities.leaseId, second));
		expect(bills).toHaveLength(1);
	});

	it("still limits rapid tenant submissions", async () => {
		const { api, leaseIds } = await tenantWithLeases(1);
		const leaseId = leaseIds[0];
		if (!leaseId) throw new Error("Fixture created no lease");
		// Five tenant submissions in distinct past months all count.
		const daysAgo = [200, 160, 120, 80, 40];
		let previous = 0;
		for (const days of daysAgo) {
			previous += 100;
			await api.submitReading({
				currentReading: previous,
				readingDate: daysAgoKey(days),
				leaseId,
			});
		}

		await expect(
			api.submitReading({
				currentReading: previous + 100,
				readingDate: daysAgoKey(2),
				leaseId,
			}),
		).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
	});
});
