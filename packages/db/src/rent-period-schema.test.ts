// C02 schema tests. Per the AGENTS.md test rule, each case pins a regression
// the database must refuse, not an implementation detail:
// - a duplicate charge for the same lease/period would double-bill a tenant;
// - malformed charges (non-positive amount, bad period key, due date outside
//   the period) would silently corrupt balances;
// - an allocation without exactly one source (payment XOR credit) or with a
//   zero amount would corrupt the outstanding derivation;
// - the same source row counting twice against one charge double-settles it;
// - deleting a settled source row must be refused so settled history cannot
//   evaporate (B03 FK precedent).
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
	rentCharges,
	units,
} from "@rently/db/schema/schema";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

const db = createDb();

const createdUserIds: string[] = [];
const createdPropertyIds: string[] = [];
const createdUnitIds: string[] = [];
const createdLeaseIds: string[] = [];
const createdPaymentIds: string[] = [];
const createdCreditIds: string[] = [];

const RENT = 150_000;

// Drizzle wraps driver errors (the Postgres code nests under cause).
function violationCode(error: unknown): string | undefined {
	const top = error as { code?: unknown; cause?: unknown } | null;
	if (typeof top?.code === "string") return top.code;
	const cause = top?.cause as { code?: unknown } | null | undefined;
	if (typeof cause?.code === "string") return cause.code;
	return undefined;
}

async function expectViolation(promise: Promise<unknown>, code: string) {
	const outcome = await promise.then(
		() => "fulfilled",
		(error: unknown) => violationCode(error),
	);
	expect(outcome, `expected violation ${code}`).toBe(code);
}

async function fixtureLease() {
	const ownerId = crypto.randomUUID();
	createdUserIds.push(ownerId);
	await db.insert(user).values({
		id: ownerId,
		name: "C02 Owner",
		email: `${ownerId}@test.keyhq.invalid`,
		role: "owner",
	});
	const tenantId = crypto.randomUUID();
	createdUserIds.push(tenantId);
	await db.insert(user).values({
		id: tenantId,
		name: "C02 Tenant",
		email: `${tenantId}@test.keyhq.invalid`,
		role: "tenant",
	});
	const propertyId = crypto.randomUUID();
	createdPropertyIds.push(propertyId);
	await db.insert(properties).values({
		id: propertyId,
		ownerId,
		name: "C02 Property",
		address: "1 C02 Road, Mumbai",
		type: PROPERTY_TYPES.RESIDENTIAL,
	});
	const [unit] = await db
		.insert(units)
		.values({
			id: crypto.randomUUID(),
			propertyId,
			unitNumber: "C02-U",
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
			startDate: new Date("2026-01-17T00:00:00.000Z"),
			endDate: new Date("2027-01-17T00:00:00.000Z"),
			rent: RENT,
			status: "active",
		})
		.returning();
	createdLeaseIds.push(lease?.id as string);
	return { leaseId: lease?.id as string, ownerId };
}

async function validCharge(leaseId: string) {
	const [charge] = await db
		.insert(rentCharges)
		.values({
			leaseId,
			periodKey: "2026-10",
			dueDate: "2026-10-05",
			amount: RENT,
		})
		.returning();
	return charge;
}

async function settledPayment(leaseId: string) {
	const [payment] = await db
		.insert(payments)
		.values({
			leaseId,
			amount: RENT,
			paymentDate: new Date("2026-09-06T00:00:00.000Z"),
			type: PAYMENT_TYPES.RENT,
		})
		.returning();
	createdPaymentIds.push(payment?.id as string);
	return payment;
}

async function discountCredit(
	leaseId: string,
	ownerId: string,
	amount: number,
) {
	const [credit] = await db
		.insert(billCredits)
		.values({
			leaseId,
			ownerId,
			type: CREDIT_TYPES.DISCOUNT,
			amount,
			reason: "C02 allocation source credit",
			creditNoteNo: crypto.randomUUID(),
			createdBy: ownerId,
		})
		.returning();
	createdCreditIds.push(credit?.id as string);
	return credit;
}

afterEach(async () => {
	// No writers exist for the period tables outside this suite, so clearing
	// them wholesale is full fixture cleanup. Sources go last (RESTRICT FKs).
	await db.delete(rentAllocations);
	await db.delete(rentCharges);
	for (const id of createdPaymentIds) {
		await db.delete(payments).where(eq(payments.id, id));
	}
	for (const id of createdCreditIds) {
		await db.delete(billCredits).where(eq(billCredits.id, id));
	}
	for (const id of createdLeaseIds) {
		await db.delete(leases).where(eq(leases.id, id));
	}
	for (const id of createdUnitIds) {
		await db.delete(units).where(eq(units.id, id));
	}
	for (const id of createdPropertyIds) {
		await db.delete(properties).where(eq(properties.id, id));
	}
	for (const id of createdUserIds) {
		await db.delete(user).where(eq(user.id, id));
	}
	createdUserIds.length = 0;
	createdPropertyIds.length = 0;
	createdUnitIds.length = 0;
	createdLeaseIds.length = 0;
	createdPaymentIds.length = 0;
	createdCreditIds.length = 0;
});

describe("C02 rent-period schema", () => {
	it("accepts a valid charge with payment and credit allocations (control)", async () => {
		const { leaseId, ownerId } = await fixtureLease();
		const charge = await validCharge(leaseId);
		const payment = await settledPayment(leaseId);
		const credit = await discountCredit(leaseId, ownerId, -50_000);
		const chargeId = charge?.id as string;

		await db.insert(rentAllocations).values([
			// A ₹1,000 partial payment (R8) plus the discount settle the charge.
			{ chargeId, paymentId: payment?.id, amount: 100_000 },
			// A −₹500 discount settles +₹500 of the charge (sign inversion).
			{ chargeId, creditId: credit?.id, amount: 50_000 },
		]);

		const allocations = await db
			.select()
			.from(rentAllocations)
			.where(eq(rentAllocations.chargeId, chargeId));
		expect(allocations).toHaveLength(2);
		// Outstanding = amount − sum(allocations) = 0: fully settled by money
		// plus discount.
		const settled = allocations.reduce((sum, a) => sum + a.amount, 0);
		expect((charge?.amount ?? 0) - settled).toBe(0);
	});

	it("refuses a second charge for the same lease and period", async () => {
		const { leaseId } = await fixtureLease();
		await validCharge(leaseId);
		await expectViolation(
			db.insert(rentCharges).values({
				leaseId,
				periodKey: "2026-10",
				dueDate: "2026-10-05",
				amount: RENT,
			}),
			"23505",
		);
	});

	it("refuses malformed charges", async () => {
		const { leaseId } = await fixtureLease();
		// amount must be positive
		await expectViolation(
			db.insert(rentCharges).values({
				leaseId,
				periodKey: "2026-09",
				dueDate: "2026-09-05",
				amount: 0,
			}),
			"23514",
		);
		// period key must be YYYY-MM
		await expectViolation(
			db.insert(rentCharges).values({
				leaseId,
				periodKey: "2026-9",
				dueDate: "2026-09-05",
				amount: RENT,
			}),
			"23514",
		);
		// due date must fall in the charge period or the following period
		await expectViolation(
			db.insert(rentCharges).values({
				leaseId,
				periodKey: "2026-09",
				dueDate: "2026-11-05",
				amount: RENT,
			}),
			"23514",
		);
	});

	it("refuses allocations without exactly one source or with a zero amount", async () => {
		const { leaseId, ownerId } = await fixtureLease();
		const charge = await validCharge(leaseId);
		const payment = await settledPayment(leaseId);
		const credit = await discountCredit(leaseId, ownerId, -25_000);
		const chargeId = charge?.id as string;

		// No source at all.
		await expectViolation(
			db.insert(rentAllocations).values({ chargeId, amount: RENT }),
			"23514",
		);
		// Both sources at once.
		await expectViolation(
			db.insert(rentAllocations).values({
				chargeId,
				paymentId: payment?.id,
				creditId: credit?.id,
				amount: RENT,
			}),
			"23514",
		);
		// Zero amount.
		await expectViolation(
			db
				.insert(rentAllocations)
				.values({ chargeId, paymentId: payment?.id, amount: 0 }),
			"23514",
		);
	});

	it("refuses the same source row allocated twice to one charge", async () => {
		const { leaseId } = await fixtureLease();
		const charge = await validCharge(leaseId);
		const payment = await settledPayment(leaseId);
		const chargeId = charge?.id as string;
		await db
			.insert(rentAllocations)
			.values({ chargeId, paymentId: payment?.id, amount: 100_000 });
		await expectViolation(
			db
				.insert(rentAllocations)
				.values({ chargeId, paymentId: payment?.id, amount: 50_000 }),
			"23505",
		);
	});

	it("refuses deleting a payment that an allocation references", async () => {
		const { leaseId } = await fixtureLease();
		const charge = await validCharge(leaseId);
		const payment = await settledPayment(leaseId);
		await db.insert(rentAllocations).values({
			chargeId: charge?.id as string,
			paymentId: payment?.id,
			amount: RENT,
		});
		// RESTRICT deletes raise 23001 (restrict_violation, class 23 FK family).
		await expectViolation(
			db.delete(payments).where(eq(payments.id, payment?.id as string)),
			"23001",
		);
	});
});
