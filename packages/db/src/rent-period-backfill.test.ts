// C03 backfill tests. Per the AGENTS.md test rule, each case pins a contract
// from docs/Rent-Period-Rules.md that the one-time migration must honor on
// production-shaped history:
// - every period a lease was active gets exactly one charge, prorated at
//   tenancy edges (R2/R4/R5) — wrong charges would misstate every future bill;
// - historical rent flows allocate FIFO oldest-period-first and mirror
//   reversal semantics (R7 + B03/B12) — wrong allocations would rewrite who
//   paid what;
// - flows that cannot fit the deterministic charge set and ambiguous accrual
//   ends surface in the exception report instead of being guessed (Fix-Plan
//   C03 done-criterion);
// - re-running the migration changes nothing (deploy safety).
import { readFileSync } from "node:fs";
import path from "node:path";
import { createDb } from "@rently/db";
import { CREDIT_TYPES } from "@rently/db/constants/payment-constants";
import {
	PAYMENT_TYPES,
	PROPERTY_TYPES,
	UNIT_STATUSES,
	UNIT_TYPES,
} from "@rently/db/constants/rent-constants";
import { user } from "@rently/db/schema/auth";
import {
	billCredits,
	leases,
	payments,
	properties,
	rentAllocations,
	rentBackfillExceptions,
	rentCharges,
	units,
} from "@rently/db/schema/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

const db = createDb();

const migrationSql = readFileSync(
	path.join(import.meta.dirname, "schema/migrations/0032_curvy_argent.sql"),
	"utf8",
);

// The migration file is fully idempotent (IF NOT EXISTS + ON CONFLICT DO
// NOTHING + exceptions recomputed), so the test re-runs it after inserting
// fixtures — the same statements production executes.
async function runBackfill() {
	for (const statement of migrationSql.split("--> statement-breakpoint")) {
		const trimmed = statement.trim();
		if (!trimmed) continue;
		await db.execute(sql.raw(trimmed));
	}
}

const createdUserIds: string[] = [];
const createdPropertyIds: string[] = [];
const createdUnitIds: string[] = [];
const createdLeaseIds: string[] = [];
const createdPaymentIds: string[] = [];
const createdCreditIds: string[] = [];
const fixtureLeaseIds: string[] = [];

const RENT = 150_000;

// Mirrors the migration's proration formula: round_half_up(rent × days / dim).
function prorated(rent: number, days: number, daysInMonth: number) {
	return Math.round((rent * days) / daysInMonth);
}

// Current IST month key (migration "today" is Asia/Kolkata).
function istMonthKey(offsetMonths = 0) {
	const ist = new Date(Date.now() + 5.5 * 3_600_000);
	return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1 + offsetMonths).padStart(2, "0")}`;
}

async function fixtureLease(input: {
	startDate: string;
	endDate?: string;
	status?: "active" | "terminated";
	rentDueDate?: number;
}) {
	const ownerId = crypto.randomUUID();
	createdUserIds.push(ownerId);
	await db.insert(user).values({
		id: ownerId,
		name: "C03 Owner",
		email: `${ownerId}@test.keyhq.invalid`,
		role: "owner",
	});
	const tenantId = crypto.randomUUID();
	createdUserIds.push(tenantId);
	await db.insert(user).values({
		id: tenantId,
		name: "C03 Tenant",
		email: `${tenantId}@test.keyhq.invalid`,
		role: "tenant",
	});
	const propertyId = crypto.randomUUID();
	createdPropertyIds.push(propertyId);
	await db.insert(properties).values({
		id: propertyId,
		ownerId,
		name: "C03 Property",
		address: "1 C03 Road, Mumbai",
		type: PROPERTY_TYPES.RESIDENTIAL,
	});
	const [unit] = await db
		.insert(units)
		.values({
			id: crypto.randomUUID(),
			propertyId,
			unitNumber: `C03-${crypto.randomUUID().slice(0, 6)}`,
			type: UNIT_TYPES.ONEBHK,
			baseRent: RENT,
			status: UNIT_STATUSES.OCCUPIED,
		})
		.returning();
	createdUnitIds.push(unit?.id as string);
	const [lease] = await db
		.insert(leases)
		.values({
			id: crypto.randomUUID(),
			unitId: unit?.id as string,
			tenantId,
			startDate: new Date(input.startDate),
			endDate: input.endDate ? new Date(input.endDate) : null,
			rent: RENT,
			rentDueDate: input.rentDueDate ?? null,
			status: input.status ?? "active",
		})
		.returning();
	const leaseId = lease?.id as string;
	createdLeaseIds.push(leaseId);
	fixtureLeaseIds.push(leaseId);
	return { leaseId, ownerId };
}

async function fixturePayment(input: {
	leaseId: string;
	amount: number;
	paymentDate: string;
	type?: "rent" | "reversal";
	reversesPaymentId?: string;
}) {
	const [payment] = await db
		.insert(payments)
		.values({
			leaseId: input.leaseId,
			amount: input.amount,
			paymentDate: new Date(input.paymentDate),
			type: input.type ?? PAYMENT_TYPES.RENT,
			reversesPaymentId: input.reversesPaymentId ?? null,
		})
		.returning();
	createdPaymentIds.push(payment?.id as string);
	return payment;
}

async function fixtureCredit(input: {
	leaseId: string;
	ownerId: string;
	amount: number;
	createdAt: string;
}) {
	const [credit] = await db
		.insert(billCredits)
		.values({
			leaseId: input.leaseId,
			ownerId: input.ownerId,
			type: CREDIT_TYPES.DISCOUNT,
			amount: input.amount,
			reason: "C03 backfill fixture credit",
			creditNoteNo: crypto.randomUUID(),
			createdBy: input.ownerId,
			createdAt: new Date(input.createdAt),
		})
		.returning();
	createdCreditIds.push(credit?.id as string);
	return credit;
}

async function chargesFor(leaseId: string) {
	return db
		.select()
		.from(rentCharges)
		.where(eq(rentCharges.leaseId, leaseId))
		.orderBy(rentCharges.periodKey);
}

async function allocationsFor(leaseId: string) {
	return db
		.select({
			periodKey: rentCharges.periodKey,
			paymentId: rentAllocations.paymentId,
			creditId: rentAllocations.creditId,
			amount: rentAllocations.amount,
		})
		.from(rentAllocations)
		.innerJoin(rentCharges, eq(rentAllocations.chargeId, rentCharges.id))
		.where(eq(rentCharges.leaseId, leaseId))
		.orderBy(rentCharges.periodKey, rentAllocations.amount);
}

function netByPeriod(rows: Array<{ periodKey: string; amount: number }>) {
	const nets = new Map<string, number>();
	for (const row of rows) {
		nets.set(row.periodKey, (nets.get(row.periodKey) ?? 0) + row.amount);
	}
	return nets;
}

function exceptionsFor(leaseId: string, kind: string) {
	return db
		.select()
		.from(rentBackfillExceptions)
		.where(
			and(
				eq(rentBackfillExceptions.leaseId, leaseId),
				eq(rentBackfillExceptions.kind, kind),
			),
		);
}

afterEach(async () => {
	// Scope cleanup to fixture leases; residue backfill rows from other
	// suites' leases stay (rently_test is disposable and scoped assertions
	// never touch them).
	if (fixtureLeaseIds.length > 0) {
		await db
			.delete(rentAllocations)
			.where(
				inArray(
					rentAllocations.chargeId,
					db
						.select({ id: rentCharges.id })
						.from(rentCharges)
						.where(inArray(rentCharges.leaseId, fixtureLeaseIds)),
				),
			);
		await db
			.delete(rentCharges)
			.where(inArray(rentCharges.leaseId, fixtureLeaseIds));
		await db
			.delete(rentBackfillExceptions)
			.where(inArray(rentBackfillExceptions.leaseId, fixtureLeaseIds));
	}
	if (createdPaymentIds.length > 0) {
		await db.delete(payments).where(inArray(payments.id, createdPaymentIds));
	}
	if (createdCreditIds.length > 0) {
		await db
			.delete(billCredits)
			.where(inArray(billCredits.id, createdCreditIds));
	}
	if (createdLeaseIds.length > 0) {
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
	if (createdUserIds.length > 0) {
		await db.delete(user).where(inArray(user.id, createdUserIds));
	}
	createdUserIds.length = 0;
	createdPropertyIds.length = 0;
	createdUnitIds.length = 0;
	createdLeaseIds.length = 0;
	createdPaymentIds.length = 0;
	createdCreditIds.length = 0;
	fixtureLeaseIds.length = 0;
});

describe("C03 rent-period backfill", () => {
	it("charges every period of ended and ongoing leases with exact due dates", async () => {
		// Ended lease: fully deterministic — three full months, due day 5.
		const ended = await fixtureLease({
			startDate: "2026-01-01",
			endDate: "2026-03-31",
			rentDueDate: 5,
		});
		// Ongoing lease: starts on the 1st two months ago (IST), so it must
		// hold charges for that month, last month, and the current month —
		// and never a future period.
		const started = new Date();
		started.setUTCDate(1);
		started.setUTCMonth(started.getUTCMonth() - 2);
		const ongoingStart = started.toISOString().slice(0, 10);
		const ongoing = await fixtureLease({
			startDate: ongoingStart,
			rentDueDate: 5,
		});

		await runBackfill();

		const endedCharges = await chargesFor(ended.leaseId);
		expect(endedCharges.map((c) => c.periodKey)).toEqual([
			"2026-01",
			"2026-02",
			"2026-03",
		]);
		expect(endedCharges.map((c) => c.amount)).toEqual([RENT, RENT, RENT]);
		expect(endedCharges.map((c) => c.dueDate)).toEqual([
			"2026-01-05",
			"2026-02-05",
			"2026-03-05",
		]);

		const ongoingCharges = await chargesFor(ongoing.leaseId);
		expect(ongoingCharges).toHaveLength(3);
		expect(ongoingCharges.every((c) => c.amount === RENT)).toBe(true);
		expect(ongoingCharges.at(-1)?.periodKey).toBe(istMonthKey());
	});

	it("prorates tenancy edges and reports a lifetime overpayment as an exception", async () => {
		// Starts on the 17th of July (15 of 31 days), ends Aug 5 (5 of 31 days).
		// The historical lifetime model collected a full month, so the
		// collected 150,000 cannot fit the deterministic 96,775 of charges:
		// the remainder must be listed, not invented away.
		const { leaseId } = await fixtureLease({
			startDate: "2026-07-17",
			endDate: "2026-08-05",
		});
		await fixturePayment({
			leaseId,
			amount: RENT,
			paymentDate: "2026-07-20",
		});
		await runBackfill();

		const charges = await chargesFor(leaseId);
		expect(charges.map((c) => c.periodKey)).toEqual(["2026-07", "2026-08"]);
		const july = prorated(RENT, 15, 31);
		const august = prorated(RENT, 5, 31);
		expect(charges.map((c) => c.amount)).toEqual([july, august]);
		expect(july).toBe(72_581);
		expect(august).toBe(24_194);

		const nets = netByPeriod(await allocationsFor(leaseId));
		expect(nets.get("2026-07")).toBe(july);
		expect(nets.get("2026-08")).toBe(august);

		const exceptions = await exceptionsFor(
			leaseId,
			"unallocated_source_remainder",
		);
		expect(exceptions).toHaveLength(1);
		expect(exceptions[0]?.amount).toBe(RENT - july - august);
	});

	it("mirrors void-then-repay: the reversal reopens the settled period", async () => {
		const { leaseId } = await fixtureLease({
			startDate: "2026-07-01",
			endDate: "2026-09-30",
			rentDueDate: 5,
		});
		const first = await fixturePayment({
			leaseId,
			amount: RENT,
			paymentDate: "2026-07-05",
		});
		const reversal = await fixturePayment({
			leaseId,
			amount: -RENT,
			paymentDate: "2026-07-06",
			type: "reversal",
			reversesPaymentId: first?.id,
		});
		await fixturePayment({
			leaseId,
			amount: RENT,
			paymentDate: "2026-08-01",
		});
		await runBackfill();

		const allocations = await allocationsFor(leaseId);
		const reversalRow = allocations.find(
			(a) => a.paymentId === (reversal?.id ?? null),
		);
		expect(reversalRow).toMatchObject({ periodKey: "2026-07", amount: -RENT });

		const nets = netByPeriod(allocations);
		// July: paid then voided (net 0), August: re-paid, September: unpaid.
		expect(nets.get("2026-07")).toBe(0);
		expect(nets.get("2026-08")).toBe(RENT);
		expect(nets.get("2026-09")).toBeUndefined();
	});

	it("allocates rent credits FIFO alongside payments", async () => {
		const { leaseId, ownerId } = await fixtureLease({
			startDate: "2026-07-01",
			endDate: "2026-08-31",
			rentDueDate: 5,
		});
		const credit = await fixtureCredit({
			leaseId,
			ownerId,
			amount: -50_000,
			createdAt: "2026-07-10T00:00:00.000Z",
		});
		await fixturePayment({
			leaseId,
			amount: 100_000,
			paymentDate: "2026-08-01",
		});
		await runBackfill();

		const allocations = await allocationsFor(leaseId);
		const creditRow = allocations.find(
			(a) => a.creditId === (credit?.id ?? null),
		);
		expect(creditRow).toMatchObject({ periodKey: "2026-07", amount: 50_000 });
		const nets = netByPeriod(allocations);
		expect(nets.get("2026-07")).toBe(RENT); // 50,000 discount + 100,000 payment
		expect(nets.get("2026-08")).toBeUndefined();
	});

	it("reports a terminated lease without an end date instead of guessing accrual", async () => {
		const { leaseId } = await fixtureLease({
			startDate: "2026-07-01",
			status: "terminated",
		});
		await runBackfill();

		expect(await chargesFor(leaseId)).toHaveLength(0);
		const exceptions = await exceptionsFor(leaseId, "lease_end_ambiguous");
		expect(exceptions).toHaveLength(1);
	});

	it("is idempotent: re-running the migration changes no rows", async () => {
		const { leaseId } = await fixtureLease({
			startDate: "2026-07-17",
			endDate: "2026-08-05",
		});
		await fixturePayment({
			leaseId,
			amount: RENT,
			paymentDate: "2026-07-20",
		});
		await runBackfill();
		const chargesBefore = await chargesFor(leaseId);
		const allocationsBefore = await allocationsFor(leaseId);
		const exceptionsBefore = await db
			.select()
			.from(rentBackfillExceptions)
			.where(eq(rentBackfillExceptions.leaseId, leaseId));

		await runBackfill();

		expect(await chargesFor(leaseId)).toEqual(chargesBefore);
		expect(await allocationsFor(leaseId)).toEqual(allocationsBefore);
		// Exception rows are recomputed (new ids/timestamps) — content is stable.
		const stripStable = (
			rows: Array<typeof rentBackfillExceptions.$inferSelect>,
		) =>
			rows
				.map(
					({
						kind,
						amount,
						detail,
						leaseId: l,
						paymentId: p,
						creditId: c,
					}) => ({
						kind,
						amount,
						detail,
						leaseId: l,
						paymentId: p,
						creditId: c,
					}),
				)
				.sort((a, b) => a.kind.localeCompare(b.kind) || b.amount - a.amount);
		expect(
			stripStable(
				await db
					.select()
					.from(rentBackfillExceptions)
					.where(eq(rentBackfillExceptions.leaseId, leaseId)),
			),
		).toEqual(stripStable(exceptionsBefore));
	});

	it("reconciles: no charge is over-allocated and every leftover flow is listed", async () => {
		const simple = await fixtureLease({
			startDate: "2026-07-01",
			endDate: "2026-08-31",
			rentDueDate: 5,
		});
		await fixturePayment({
			leaseId: simple.leaseId,
			amount: RENT,
			paymentDate: "2026-07-05",
		});
		const overpaid = await fixtureLease({
			startDate: "2026-07-17",
			endDate: "2026-08-05",
		});
		await fixturePayment({
			leaseId: overpaid.leaseId,
			amount: RENT,
			paymentDate: "2026-07-20",
		});
		await runBackfill();

		for (const leaseId of fixtureLeaseIds) {
			const charges = await chargesFor(leaseId);
			const allocationNets = netByPeriod(await allocationsFor(leaseId));
			for (const charge of charges) {
				expect(allocationNets.get(charge.periodKey) ?? 0).toBeLessThanOrEqual(
					charge.amount,
				);
			}
		}

		const remainder = await exceptionsFor(
			overpaid.leaseId,
			"unallocated_source_remainder",
		);
		expect(remainder).toHaveLength(1);
		const simpleRemainder = await exceptionsFor(
			simple.leaseId,
			"unallocated_source_remainder",
		);
		expect(simpleRemainder).toHaveLength(0);
	});
});
