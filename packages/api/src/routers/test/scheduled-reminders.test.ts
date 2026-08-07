import { createDb } from "@rently/db";
import { user } from "@rently/db/schema/auth";
import {
	leases,
	notificationPreferences,
	properties,
	rentReminderSuppressions,
	scheduledEmailDeliveries,
	units,
} from "@rently/db/schema/schema";
import { eq, inArray } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	sendLeaseExpiryReminderEmail: vi.fn(),
	sendRentDueReminderEmail: vi.fn(),
	sendOverdueRentReminderEmail: vi.fn(),
}));

vi.mock("@rently/email", () => mocks);

import { runScheduledReminderJob } from "../../scheduled-reminders";

const db = createDb();
const created = {
	users: [] as string[],
	properties: [] as string[],
	units: [] as string[],
	leases: [] as string[],
};

async function seedLease(options: {
	endDate?: Date | null;
	ownerPreferences?: Partial<{
		leaseExpiryAlert: boolean;
		rentDueReminder: boolean;
		overdueAlert: boolean;
		rentDueLeadDays: number;
		overdueGraceDays: number;
	}>;
	suppressNextPeriod?: boolean;
}) {
	const ownerId = crypto.randomUUID();
	const tenantId = crypto.randomUUID();
	const propertyId = crypto.randomUUID();
	const unitId = crypto.randomUUID();
	const leaseId = crypto.randomUUID();
	created.users.push(ownerId, tenantId);
	created.properties.push(propertyId);
	created.units.push(unitId);
	created.leases.push(leaseId);

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
		endDate:
			options.endDate === undefined
				? new Date("2026-09-06T00:00:00Z")
				: options.endDate,
		rent: 100_000,
		status: "active",
		rentDueDate: 10,
	});
	if (options.ownerPreferences) {
		await db.insert(notificationPreferences).values({
			ownerId,
			...options.ownerPreferences,
		});
	}
	if (options.suppressNextPeriod) {
		await db.insert(rentReminderSuppressions).values({
			ownerId,
			leaseId,
			periodKey: "2026-08",
		});
	}

	return { ownerId, tenantId, leaseId };
}

afterEach(async () => {
	if (created.leases.length) {
		await db
			.delete(scheduledEmailDeliveries)
			.where(inArray(scheduledEmailDeliveries.leaseId, created.leases));
		await db
			.delete(rentReminderSuppressions)
			.where(inArray(rentReminderSuppressions.leaseId, created.leases));
		await db
			.delete(notificationPreferences)
			.where(inArray(notificationPreferences.ownerId, created.users));
		await db.delete(leases).where(inArray(leases.id, created.leases));
		await db.delete(units).where(inArray(units.id, created.units));
		await db
			.delete(properties)
			.where(inArray(properties.id, created.properties));
		await db.delete(user).where(inArray(user.id, created.users));
	}
	created.users.length = 0;
	created.properties.length = 0;
	created.units.length = 0;
	created.leases.length = 0;
	vi.clearAllMocks();
});

beforeEach(() => {
	mocks.sendLeaseExpiryReminderEmail.mockResolvedValue(undefined);
	mocks.sendRentDueReminderEmail.mockResolvedValue(undefined);
	mocks.sendOverdueRentReminderEmail.mockResolvedValue(undefined);
});

describe("scheduled reminder job", () => {
	it("sends qualifying reminders once and deduplicates repeated runs", async () => {
		const fixture = await seedLease({});
		const now = new Date("2026-08-06T18:30:00.000Z"); // 07 Aug 2026, 00:00 IST

		const first = await runScheduledReminderJob({
			db,
			now,
			ownerId: fixture.ownerId,
		});
		const second = await runScheduledReminderJob({
			db,
			now,
			ownerId: fixture.ownerId,
		});

		expect(first.sent).toBe(2);
		expect(second.sent).toBe(0);
		expect(second.duplicateSkipped).toBe(2);
		expect(mocks.sendLeaseExpiryReminderEmail).toHaveBeenCalledOnce();
		expect(mocks.sendRentDueReminderEmail).toHaveBeenCalledOnce();
		expect(mocks.sendOverdueRentReminderEmail).not.toHaveBeenCalled();
	});

	it("enforces each scheduled preference independently", async () => {
		const fixture = await seedLease({
			endDate: null,
			ownerPreferences: { rentDueReminder: false },
		});

		const result = await runScheduledReminderJob({
			db,
			now: new Date("2026-08-06T18:30:00.000Z"),
			ownerId: fixture.ownerId,
		});

		expect(result.preferenceSkipped).toBe(1);
		expect(result.sent).toBe(0);
		expect(mocks.sendRentDueReminderEmail).not.toHaveBeenCalled();
	});

	it("skips both rent-cycle emails for a suppressed period", async () => {
		const fixture = await seedLease({
			endDate: null,
			suppressNextPeriod: true,
		});

		const result = await runScheduledReminderJob({
			db,
			now: new Date("2026-08-06T18:30:00.000Z"),
			ownerId: fixture.ownerId,
		});

		expect(result.suppressionSkipped).toBe(1);
		expect(result.sent).toBe(0);
		expect(mocks.sendRentDueReminderEmail).not.toHaveBeenCalled();
	});

	it("records a provider failure and never retries that key", async () => {
		const fixture = await seedLease({ endDate: null });
		mocks.sendRentDueReminderEmail.mockRejectedValueOnce(
			new Error("provider down"),
		);
		const now = new Date("2026-08-06T18:30:00.000Z");

		const first = await runScheduledReminderJob({
			db,
			now,
			ownerId: fixture.ownerId,
		});
		const second = await runScheduledReminderJob({
			db,
			now,
			ownerId: fixture.ownerId,
		});
		const deliveries = await db
			.select({ status: scheduledEmailDeliveries.status })
			.from(scheduledEmailDeliveries)
			.where(eq(scheduledEmailDeliveries.leaseId, created.leases[0] as string));

		expect(first.failed).toBe(1);
		expect(second.duplicateSkipped).toBeGreaterThanOrEqual(1);
		expect(mocks.sendRentDueReminderEmail).toHaveBeenCalledOnce();
		expect(deliveries).toContainEqual({ status: "failed" });
	});
});
