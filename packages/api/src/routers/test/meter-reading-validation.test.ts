// G02 meter-reading precision and bounds — regression rationale:
// Tenant readings were `.int().max(500)`, so fractional meter values were
// rejected and any cumulative meter past 500 kWh became unusable — while the
// UI already parses floats. The fix accepts fractional readings and replaces
// the absolute cap with a per-submission consumption-delta cap, keeping
// anomaly protection (absurd jumps and decreases still refuse). The
// jump/decrease pins stay green pre-fix by design: they guard the removal.
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

function yesterdayKey(): string {
	return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function tenantWithLease() {
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
	const unitId = crypto.randomUUID();
	createdUnitIds.push(unitId);
	await db.insert(units).values({
		id: unitId,
		propertyId,
		unitNumber: `G02-${unitId.slice(0, 4)}`,
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
	mocks.getSession.mockResolvedValue({
		user: { id: tenantId, role: "tenant" },
		session: { id: "test-session" },
	});
	const context = { db, headers: new Headers() } as never;
	return {
		api: createRouterClient({ submitReading }, { context }),
		leaseId,
	};
}

async function seedPriorBill(leaseId: string, currentReading: number) {
	await db.insert(utilities).values({
		leaseId,
		utilityType: "electricity",
		previousReading: 0,
		currentReading,
		previousReadingDate: new Date("2026-05-01T00:00:00.000Z"),
		currentReadingDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
		unitsUsed: currentReading,
		ratePerUnit: 900,
		fixedCharge: 10000,
		totalAmount: Math.round(currentReading * 900 + 10000),
		isPaid: false,
	});
}

async function billsFor(leaseId: string) {
	return db
		.select({
			currentReading: utilities.currentReading,
			unitsUsed: utilities.unitsUsed,
		})
		.from(utilities)
		.where(eq(utilities.leaseId, leaseId));
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

describe("G02 meter-reading precision and bounds", () => {
	it("accepts a fractional reading", async () => {
		const { api, leaseId } = await tenantWithLease();

		await api.submitReading({
			currentReading: 123.5,
			readingDate: yesterdayKey(),
		});

		expect(await billsFor(leaseId)).toContainEqual({
			currentReading: 123.5,
			unitsUsed: 123.5,
		});
	});

	it("accepts a cumulative meter past 500 kWh", async () => {
		const { api, leaseId } = await tenantWithLease();
		await seedPriorBill(leaseId, 600);

		await api.submitReading({
			currentReading: 650,
			readingDate: yesterdayKey(),
		});

		const bills = await billsFor(leaseId);
		expect(bills).toHaveLength(2);
	});

	it("refuses a suspicious consumption jump", async () => {
		const { api, leaseId } = await tenantWithLease();
		await seedPriorBill(leaseId, 100);

		await expect(
			api.submitReading({
				currentReading: 2500,
				readingDate: yesterdayKey(),
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		expect(await billsFor(leaseId)).toHaveLength(1);
	});

	it("refuses a decreasing reading", async () => {
		const { api, leaseId } = await tenantWithLease();
		await seedPriorBill(leaseId, 100);

		await expect(
			api.submitReading({
				currentReading: 90,
				readingDate: yesterdayKey(),
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		expect(await billsFor(leaseId)).toHaveLength(1);
	});
});
