// G03 meter-reading chronology — regression rationale:
// The "previous reading" lookup took the globally latest bill, so a
// backdated submission compared against a LATER reading and was refused (or
// mis-chained); and the batch path checked-then-inserted the monthly guard
// with no arbitration, so concurrent same-month submissions duplicated. The
// fix selects the previous reading strictly before the submitted date and
// makes the guarded insert a single conditional statement. No unique index:
// production-shaped dev data holds a legitimate paid correction pair in one
// month that must never be deleted.
import { createRouterClient } from "@orpc/server";
import type { Database } from "@rently/db";
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

// Neon-batch shim (D04/E05 precedent): selects the supportsBatch branch while
// retaining the disposable local connection. Rows here feed arithmetic and
// inserts only, so the raw mapper suffices — plus timestamp parsing for the
// utility date keys the handler reuses as bill dates.
function neonPathDatabase() {
	const toCamel = (key: string) =>
		key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
	const timestampKeys = new Set([
		"start_date",
		"end_date",
		"created_at",
		"updatedAt",
		"updated_at",
		"reading_date",
		"previous_reading_date",
	]);
	const parseTimestamp = (value: string) =>
		new Date(
			/Z|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value.replace(" ", "T")}Z`,
		);
	const mapRow = (row: Record<string, unknown>) =>
		Object.fromEntries(
			Object.entries(row).map(([key, value]) => [
				toCamel(key),
				timestampKeys.has(key) && typeof value === "string"
					? parseTimestamp(value)
					: value,
			]),
		);
	return new Proxy(db, {
		get(target, property, receiver) {
			if (property === "batch") {
				return (queries: Array<{ getSQL: () => unknown }>) =>
					target.transaction(async (tx) => {
						const results = [];
						for (const query of queries) {
							const raw = await tx.execute(query.getSQL() as never);
							const rows = (raw.rows ?? raw) as Array<Record<string, unknown>>;
							results.push(rows.map(mapRow));
						}
						return results;
					});
			}
			return Reflect.get(target, property, receiver);
		},
	}) as unknown as Database;
}

// Forces the exact overlap two workers hit on the batch path: the first
// utilities insert waits until BOTH workers have issued theirs — and an
// insert is only issued after the monthly check passes — so both checks see
// zero bills and both inserts race. Other tables pass through untouched.
function gateBatchInsertRace(inner: Database) {
	let insertsIssued = 0;
	let insertsHeld = 0;
	let release!: () => void;
	const released = new Promise<void>((resolve) => {
		release = resolve;
	});
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
						if (insertsHeld === 0) {
							insertsHeld += 1;
							void released.then(run);
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
			if (property === "insert" && typeof value === "function") {
				return (table: unknown, ...args: unknown[]) => {
					const builder = Reflect.apply(
						value as (...args: unknown[]) => unknown,
						target,
						[table, ...args],
					);
					if (table !== utilities) return builder;
					insertsIssued += 1;
					if (insertsIssued >= 2) release();
					return gateBuilder(builder);
				};
			}
			if (typeof value === "function") {
				return (...args: unknown[]) =>
					Reflect.apply(value as (...args: unknown[]) => unknown, target, args);
			}
			return value;
		},
	}) as unknown as Database;
}

function daysAgoKey(days: number): string {
	return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
		.toISOString()
		.slice(0, 10);
}

function daysAgoDate(days: number): Date {
	return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
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
		unitNumber: `G03-${unitId.slice(0, 4)}`,
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
	return { tenantId, leaseId };
}

function clientFor(database: Database) {
	const context = { db: database, headers: new Headers() } as never;
	return createRouterClient({ submitReading }, { context });
}

async function seedBill(
	leaseId: string,
	currentReading: number,
	daysAgo: number,
) {
	const currentReadingDate = daysAgoDate(daysAgo);
	await db.insert(utilities).values({
		leaseId,
		utilityType: "electricity",
		previousReading: 0,
		currentReading,
		previousReadingDate: new Date(
			currentReadingDate.getTime() - 30 * 24 * 60 * 60 * 1000,
		),
		currentReadingDate,
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
			previousReading: utilities.previousReading,
			currentReadingDate: utilities.currentReadingDate,
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

describe("G03 meter-reading chronology", () => {
	it("accepts a backdated reading chained to the temporal previous", async () => {
		const { leaseId } = await tenantWithLease();
		await seedBill(leaseId, 200, 5);

		await clientFor(db).submitReading({
			currentReading: 150,
			readingDate: daysAgoKey(70),
		});

		const bills = await billsFor(leaseId);
		expect(bills).toHaveLength(2);
		const backdated = bills.find((bill) => bill.currentReading === 150);
		expect(backdated?.previousReading).toBe(0);
	});

	it("ignores a later bill when selecting the previous reading", async () => {
		const { leaseId } = await tenantWithLease();
		await seedBill(leaseId, 100, 130);
		await seedBill(leaseId, 200, 5);

		await clientFor(db).submitReading({
			currentReading: 150,
			readingDate: daysAgoKey(70),
		});

		const bills = await billsFor(leaseId);
		expect(bills).toHaveLength(3);
		const backdated = bills.find((bill) => bill.currentReading === 150);
		expect(backdated?.previousReading).toBe(100);
	});

	it("lets exactly one of two concurrent same-month submissions succeed", async () => {
		const { leaseId } = await tenantWithLease();
		// Gate around the shim: the batch path must take the guarded insert.
		const api = clientFor(gateBatchInsertRace(neonPathDatabase()));
		const payload = {
			currentReading: 150,
			readingDate: daysAgoKey(5),
		} as const;
		const results = await Promise.allSettled([
			api.submitReading({ ...payload }),
			api.submitReading({ ...payload }),
		]);
		const fulfilled = results.filter((r) => r.status === "fulfilled");
		const rejected = results.filter((r) => r.status === "rejected");

		expect(fulfilled).toHaveLength(1);
		expect(rejected).toHaveLength(1);
		expect(rejected[0]).toMatchObject({ reason: { code: "CONFLICT" } });
		expect(await billsFor(leaseId)).toHaveLength(1);
	});
});
