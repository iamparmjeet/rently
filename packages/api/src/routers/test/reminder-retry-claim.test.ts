// F03 atomic reminder retry claiming — regression rationale:
// A FAILED delivery older than 1h becomes retry-eligible, but the reclaim
// UPDATE was unconditional: two simultaneous workers both re-claimed the
// same row and both sent. The fix makes the reclaim a single conditional
// statement (still failed AND still old), so exactly one worker wins.

import type { Database } from "@rently/db";
import { createDb } from "@rently/db";
import { SCHEDULED_EMAIL_TYPES } from "@rently/db/constants/scheduled-email-constants";
import { user } from "@rently/db/schema/auth";
import {
	leases,
	properties,
	rentAllocations,
	rentCharges,
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

import {
	claimDelivery,
	runScheduledReminderJob,
} from "../../scheduled-reminders";
import type { RentCycleItem } from "../helpers/rent-cycle";

const db = createDb();
const created = {
	users: [] as string[],
	properties: [] as string[],
	units: [] as string[],
	leases: [] as string[],
};

const NOW = new Date("2026-08-06T18:30:00.000Z");

async function seedActiveLease() {
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
		unitNumber: `F03-${unitId.slice(0, 4)}`,
		type: "1BHK",
		baseRent: 100_000,
		status: "occupied",
	});
	await db.insert(leases).values({
		id: leaseId,
		unitId,
		tenantId,
		startDate: new Date("2026-01-01T00:00:00Z"),
		endDate: null,
		rent: 100_000,
		status: "active",
		rentDueDate: 10,
	});
	return { ownerId, leaseId };
}

async function failOnce(ownerId: string) {
	mocks.sendRentDueReminderEmail.mockRejectedValueOnce(
		new Error("provider down"),
	);
	const result = await runScheduledReminderJob({ db, now: NOW, ownerId });
	expect(result.failed).toBe(1);
	vi.clearAllMocks();
}

async function ageFailedRow(leaseId: string, hoursAgo: number) {
	await db
		.update(scheduledEmailDeliveries)
		.set({ updatedAt: new Date(NOW.getTime() - hoursAgo * 60 * 60 * 1000) })
		.where(eq(scheduledEmailDeliveries.leaseId, leaseId));
}

afterEach(async () => {
	if (created.leases.length) {
		await db
			.delete(scheduledEmailDeliveries)
			.where(inArray(scheduledEmailDeliveries.leaseId, created.leases));
		await db
			.delete(rentAllocations)
			.where(
				inArray(
					rentAllocations.chargeId,
					db
						.select({ id: rentCharges.id })
						.from(rentCharges)
						.where(inArray(rentCharges.leaseId, created.leases)),
				),
			);
		await db
			.delete(rentCharges)
			.where(inArray(rentCharges.leaseId, created.leases));
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

// Holds the first reclaim UPDATE until both workers have passed the
// eligibility read, forcing the exact overlap two cron workers hit. The
// first terminal await on an update builder waits; everything else passes
// through untouched.
type ReclaimGate = {
	selects: number;
	updatesHeld: number;
	release: () => void;
	released: Promise<void>;
};

function createReclaimGate(): ReclaimGate {
	const gate: ReclaimGate = {
		selects: 0,
		updatesHeld: 0,
		release: () => {},
		released: Promise.resolve(),
	};
	gate.released = new Promise<void>((resolve) => {
		gate.release = resolve;
	});
	return gate;
}

function gatedDbForReclaimRace(inner: Database, gate: ReclaimGate) {
	const gateBuilder = (builder: unknown): unknown =>
		new Proxy(builder as object, {
			get(target, property) {
				if (property === "then") {
					return (
						resolve: (...args: unknown[]) => void,
						reject: (...args: unknown[]) => void,
					) => {
						const run = () =>
							(target as PromiseLike<unknown>).then(resolve, reject);
						if (gate.updatesHeld === 0) {
							gate.updatesHeld += 1;
							void gate.released.then(run);
							return;
						}
						return run();
					};
				}
				const value = Reflect.get(target, property);
				if (typeof value === "function") {
					return (...args: unknown[]) =>
						gateBuilder(
							Reflect.apply(
								value as (...args: unknown[]) => unknown,
								target,
								args,
							),
						);
				}
				return value;
			},
		});
	return new Proxy(inner, {
		get(target, property) {
			const value = Reflect.get(target, property);
			if (property === "select" && typeof value === "function") {
				return (...args: unknown[]) => {
					gate.selects += 1;
					if (gate.selects >= 2) gate.release();
					return Reflect.apply(
						value as (...args: unknown[]) => unknown,
						target,
						args,
					);
				};
			}
			if (property === "update" && typeof value === "function") {
				return (...args: unknown[]) =>
					gateBuilder(
						Reflect.apply(
							value as (...args: unknown[]) => unknown,
							target,
							args,
						),
					);
			}
			if (typeof value === "function") {
				return (...args: unknown[]) =>
					Reflect.apply(value as (...args: unknown[]) => unknown, target, args);
			}
			return value;
		},
	}) as Database;
}

describe("F03 reminder retry claiming", () => {
	it("lets exactly one of two simultaneous workers retry an old failure", async () => {
		const { ownerId, leaseId } = await seedActiveLease();
		const twoHoursAgo = new Date(NOW.getTime() - 2 * 60 * 60 * 1000);
		await db.insert(scheduledEmailDeliveries).values({
			ownerId,
			leaseId,
			type: SCHEDULED_EMAIL_TYPES.RENT_DUE,
			periodKey: "2026-08",
			thresholdDays: 3,
			status: "failed",
			updatedAt: twoHoursAgo,
		});
		const item = {
			type: SCHEDULED_EMAIL_TYPES.RENT_DUE,
			periodKey: "2026-08",
			thresholdDays: 3,
			row: { ownerId, leaseId },
		} as RentCycleItem;

		const gate = createReclaimGate();
		const [first, second] = await Promise.all([
			claimDelivery(gatedDbForReclaimRace(db, gate), item),
			claimDelivery(gatedDbForReclaimRace(db, gate), item),
		]);

		expect(
			[first.state, second.state].filter((state) => state === "claimed"),
		).toHaveLength(1);
	});

	it("retries only after the documented delay", async () => {
		const { ownerId, leaseId } = await seedActiveLease();
		await failOnce(ownerId);

		const early = await runScheduledReminderJob({ db, now: NOW, ownerId });
		expect(early.sent).toBe(0);
		expect(early.duplicateSkipped).toBe(1);

		await ageFailedRow(leaseId, 2);
		const late = await runScheduledReminderJob({ db, now: NOW, ownerId });
		expect(late.claimed).toBe(1);
		expect(late.sent).toBe(1);
		expect(mocks.sendRentDueReminderEmail).toHaveBeenCalledOnce();
	});
});
