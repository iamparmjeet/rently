import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import { user } from "@rently/db/schema/auth";
import {
	leases,
	properties,
	rentReminderSuppressions,
	units,
} from "@rently/db/schema/schema";
import { inArray } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@rently/auth", () => ({
	auth: { api: { getSession: mocks.getSession } },
}));

import {
	getNextRentReminderSuppression,
	resumeNextRentReminders,
	suppressNextRentReminders,
} from "../rent/lease";

const db = createDb();
const ownerIds: string[] = [];
const propertyIds: string[] = [];
const unitIds: string[] = [];
const leaseIds: string[] = [];

async function createLeaseFixture() {
	const ownerId = crypto.randomUUID();
	const tenantId = crypto.randomUUID();
	const propertyId = crypto.randomUUID();
	const unitId = crypto.randomUUID();
	const leaseId = crypto.randomUUID();
	ownerIds.push(ownerId, tenantId);
	propertyIds.push(propertyId);
	unitIds.push(unitId);
	leaseIds.push(leaseId);

	await db.insert(user).values([
		{
			id: ownerId,
			name: "Owner",
			email: `${ownerId}@test.keyhq.invalid`,
			role: "owner",
		},
		{
			id: tenantId,
			name: "Tenant",
			email: `${tenantId}@test.keyhq.invalid`,
			role: "tenant",
		},
	]);
	await db.insert(properties).values({
		id: propertyId,
		ownerId,
		name: "Palm Residency",
		address: "1 Test Road",
		type: "residential",
	});
	await db.insert(units).values({
		id: unitId,
		propertyId,
		unitNumber: "A-1",
		type: "1BHK",
		baseRent: 100_000,
		status: "occupied",
	});
	await db.insert(leases).values({
		id: leaseId,
		unitId,
		tenantId,
		startDate: new Date("2026-01-01T00:00:00Z"),
		rent: 100_000,
		status: "active",
		rentDueDate: 10,
	});

	return {
		id: ownerId,
		name: "Owner",
		email: `${ownerId}@test.keyhq.invalid`,
		role: "owner" as const,
		leaseId,
	};
}

afterEach(async () => {
	await db
		.delete(rentReminderSuppressions)
		.where(inArray(rentReminderSuppressions.leaseId, leaseIds));
	await db.delete(leases).where(inArray(leases.id, leaseIds));
	await db.delete(units).where(inArray(units.id, unitIds));
	await db.delete(properties).where(inArray(properties.id, propertyIds));
	await db.delete(user).where(inArray(user.id, ownerIds));
	ownerIds.length = 0;
	propertyIds.length = 0;
	unitIds.length = 0;
	leaseIds.length = 0;
	mocks.getSession.mockReset();
	vi.useRealTimers();
});

describe("lease rent reminder suppression", () => {
	it("suppresses and resumes the next local calendar month", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-08-07T02:30:00.000Z"));
		const owner = await createLeaseFixture();
		mocks.getSession.mockResolvedValue({
			user: owner,
			session: { id: "test-session" },
		});
		const client = createRouterClient(
			{
				getNextRentReminderSuppression,
				suppressNextRentReminders,
				resumeNextRentReminders,
			},
			{ context: { db, headers: new Headers() } },
		);

		expect(
			await client.getNextRentReminderSuppression({ leaseId: owner.leaseId }),
		).toEqual({
			periodKey: "2026-09",
			suppressed: false,
		});
		expect(
			await client.suppressNextRentReminders({ leaseId: owner.leaseId }),
		).toEqual({
			periodKey: "2026-09",
			suppressed: true,
		});
		expect(
			await client.getNextRentReminderSuppression({ leaseId: owner.leaseId }),
		).toEqual({
			periodKey: "2026-09",
			suppressed: true,
		});
		expect(
			await client.resumeNextRentReminders({ leaseId: owner.leaseId }),
		).toEqual({
			periodKey: "2026-09",
			suppressed: false,
		});
	});
});
