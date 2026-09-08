// C04 dual-write tests. Per the AGENTS.md test rule, each case pins a
// Fix-Plan C04 acceptance contract — create, credit, partial payment, full
// payment, void, credit reversal, and group settlement must all land in the
// period ledger (charges − allocations). Charge accrual at lease creation
// (R13 backdated arrears) is included because every later allocation depends
// on it. Since the C08 cutover the period ledger IS the production rent read
// (the lifetime comparison this suite once made was removed with
// getAmountDueForRent), and the writers validate against the period
// outstanding plus the R6 one-period prepay cap.
import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import {
	PAYMENT_TYPES,
	PROPERTY_TYPES,
	UNIT_STATUSES,
	UNIT_TYPES,
} from "@rently/db/constants/rent-constants";
import { user } from "@rently/db/schema/auth";
import {
	billCredits,
	leaseAgreements,
	leases,
	paymentGroups,
	payments,
	properties,
	rentAllocations,
	rentCharges,
	tenantProfiles,
	units,
	utilities,
} from "@rently/db/schema/schema";
import { and, eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
}));

vi.mock("@rently/auth", () => ({
	auth: { api: { getSession: mocks.getSession } },
}));

vi.mock("@rently/email", () => ({
	sendAgreementPaymentReceiptEmail: vi.fn(),
	sendPaymentReceiptEmail: vi.fn(),
	sendUtilityBillEmail: vi.fn(),
}));

import {
	sendAgreementPaymentReceiptEmail,
	sendPaymentReceiptEmail,
} from "@rently/email";

import { createCredit, reverseCredit } from "../rent/credit";
import { createCombinedLease, createLease } from "../rent/lease";
import {
	createAgreementPayment,
	createCombinedBillPayment,
	createPayment,
	voidPayment,
	voidPaymentGroup,
} from "../rent/payment";

const db = createDb();

const createdUserIds: string[] = [];
const createdProfileIds: string[] = [];
const createdPropertyIds: string[] = [];
const createdUnitIds: string[] = [];
const createdLeaseIds: string[] = [];
const createdAgreementIds: string[] = [];

const RENT = 150_000;
const PAYMENT_DATE = new Date("2026-09-06T00:00:00.000Z");

function clients(ownerId: string, database: typeof db = db) {
	mocks.getSession.mockResolvedValue({
		user: { id: ownerId, role: "owner" },
		session: { id: "c04-session" },
	});
	const context = { db: database, headers: new Headers() } as never;
	return createRouterClient(
		{
			createLease,
			createCombinedLease,
			createPayment,
			createCredit,
			reverseCredit,
			voidPayment,
			voidPaymentGroup,
			createAgreementPayment,
			createCombinedBillPayment,
		},
		{ context },
	);
}

async function ownerProperty() {
	const ownerId = crypto.randomUUID();
	createdUserIds.push(ownerId);
	await db.insert(user).values({
		id: ownerId,
		name: "C04 Owner",
		email: `${ownerId}@test.keyhq.invalid`,
		role: "owner",
	});
	const tenantId = crypto.randomUUID();
	createdUserIds.push(tenantId);
	await db.insert(user).values({
		id: tenantId,
		name: "C04 Tenant",
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
		name: "C04 Property",
		address: "1 C04 Road, Mumbai",
		type: PROPERTY_TYPES.RESIDENTIAL,
	});
	return { ownerId, tenantId, propertyId };
}

async function singleLease(
	ownerId: string,
	tenantId: string,
	propertyId: string,
	startDate: string,
	rentDueDate?: number,
) {
	const [unit] = await db
		.insert(units)
		.values({
			id: crypto.randomUUID(),
			propertyId,
			unitNumber: `C04-${crypto.randomUUID().slice(0, 6)}`,
			type: UNIT_TYPES.ONEBHK,
			baseRent: RENT,
			status: UNIT_STATUSES.AVAILABLE,
		})
		.returning();
	createdUnitIds.push(unit?.id as string);
	const result = await clients(ownerId).createLease({
		tenantId,
		unitId: unit?.id as string,
		startDate: new Date(startDate),
		endDate: new Date("2027-09-01T00:00:00.000Z"),
		rent: RENT,
		rentDueDate,
	});
	createdLeaseIds.push(result.lease.id);
	createdAgreementIds.push(result.lease.agreementId as string);
	return result.lease;
}

function istMonthKey(offsetMonths = 0) {
	const ist = new Date(Date.now() + 5.5 * 3_600_000);
	return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1 + offsetMonths).padStart(2, "0")}`;
}

function istMonthStart(offsetMonths = 0) {
	return `${istMonthKey(offsetMonths)}-01T00:00:00.000Z`;
}

// Mirrors the accrual formula (R4): round(rent × activeDays / daysInMonth).
function prorated(rent: number, days: number, daysInMonth: number) {
	return Math.round((rent * days) / daysInMonth);
}

// The period ledger is the only rent ledger since the C08 cutover; the
// lifetime read was removed with it.
async function outstanding(leaseId: string) {
	const charges = await db
		.select({ amount: rentCharges.amount, periodKey: rentCharges.periodKey })
		.from(rentCharges)
		.where(eq(rentCharges.leaseId, leaseId));
	const allocations = await db
		.select({ amount: rentAllocations.amount })
		.from(rentAllocations)
		.innerJoin(rentCharges, eq(rentAllocations.chargeId, rentCharges.id))
		.where(eq(rentCharges.leaseId, leaseId));
	const period =
		charges.reduce((s, c) => s + c.amount, 0) -
		allocations.reduce((s, a) => s + a.amount, 0);
	return { period, charges, allocations };
}

async function expectReconciled(leaseId: string) {
	return outstanding(leaseId);
}

afterEach(async () => {
	vi.mocked(sendAgreementPaymentReceiptEmail).mockClear();
	vi.mocked(sendPaymentReceiptEmail).mockClear();
	if (createdLeaseIds.length > 0) {
		await db
			.delete(rentAllocations)
			.where(
				inArray(
					rentAllocations.chargeId,
					db
						.select({ id: rentCharges.id })
						.from(rentCharges)
						.where(inArray(rentCharges.leaseId, createdLeaseIds)),
				),
			);
		await db
			.delete(rentCharges)
			.where(inArray(rentCharges.leaseId, createdLeaseIds));
		await db
			.delete(billCredits)
			.where(inArray(billCredits.leaseId, createdLeaseIds));
		await db.delete(payments).where(inArray(payments.leaseId, createdLeaseIds));
		await db
			.delete(utilities)
			.where(inArray(utilities.leaseId, createdLeaseIds));
	}
	if (createdAgreementIds.length > 0) {
		await db
			.delete(paymentGroups)
			.where(inArray(paymentGroups.agreementId, createdAgreementIds));
		await db
			.delete(leases)
			.where(inArray(leases.agreementId, createdAgreementIds));
		await db
			.delete(leaseAgreements)
			.where(inArray(leaseAgreements.id, createdAgreementIds));
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
	createdUserIds.length = 0;
	createdProfileIds.length = 0;
	createdPropertyIds.length = 0;
	createdUnitIds.length = 0;
	createdLeaseIds.length = 0;
	createdAgreementIds.length = 0;
	mocks.getSession.mockReset();
});

describe("C04 rent-period dual-write", () => {
	it("projects a UTC lease start into its IST rent period", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		const istCurrentMonth = new Date(istMonthStart());
		// 19:00 UTC on the prior day is 00:30 on the first day of this IST month.
		istCurrentMonth.setUTCDate(0);
		istCurrentMonth.setUTCHours(19, 0, 0, 0);
		const lease = await singleLease(
			ownerId,
			tenantId,
			propertyId,
			istCurrentMonth.toISOString(),
		);

		const charges = await db
			.select({ periodKey: rentCharges.periodKey })
			.from(rentCharges)
			.where(eq(rentCharges.leaseId, lease.id))
			.orderBy(rentCharges.periodKey);
		expect(charges).toEqual([{ periodKey: istMonthKey() }]);
	});

	it("uses the IST start day for a prepaid future charge due date", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		const start = new Date(istMonthStart());
		start.setUTCDate(0);
		start.setUTCHours(19, 0, 0, 0); // 00:30 IST on the first.
		const lease = await singleLease(
			ownerId,
			tenantId,
			propertyId,
			start.toISOString(),
		);

		await clients(ownerId).createPayment({
			leaseId: lease.id,
			amount: RENT + 1,
			paymentDate: PAYMENT_DATE,
			type: PAYMENT_TYPES.RENT,
			idempotencyKey: crypto.randomUUID(),
		});

		const [future] = await db
			.select({ dueDate: rentCharges.dueDate })
			.from(rentCharges)
			.where(
				and(
					eq(rentCharges.leaseId, lease.id),
					eq(rentCharges.periodKey, istMonthKey(1)),
				),
			)
			.limit(1);
		expect(future?.dueDate).toBe(`${istMonthKey(1)}-01`);
	});

	it("sets the first due date after a post-due-day lease start", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		const priorMonth = new Date(istMonthStart(-1));
		priorMonth.setUTCDate(20);
		const lease = await singleLease(
			ownerId,
			tenantId,
			propertyId,
			priorMonth.toISOString(),
			5,
		);

		const charges = await db
			.select({
				dueDate: rentCharges.dueDate,
				periodKey: rentCharges.periodKey,
			})
			.from(rentCharges)
			.where(eq(rentCharges.leaseId, lease.id))
			.orderBy(rentCharges.periodKey);
		expect(charges[0]).toEqual({
			periodKey: istMonthKey(-1),
			dueDate: `${istMonthKey()}-05`,
		});
	});

	it("createLease accrues charges immediately, including backdated periods", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		// Backdated mid-month start: first period prorated, then full months
		// through the current IST month (R13).
		const start = new Date(istMonthStart(-2));
		start.setUTCDate(17);
		const lease = await singleLease(
			ownerId,
			tenantId,
			propertyId,
			start.toISOString(),
		);

		const charges = await db
			.select()
			.from(rentCharges)
			.where(eq(rentCharges.leaseId, lease.id))
			.orderBy(rentCharges.periodKey);
		expect(charges).toHaveLength(3);
		expect(charges[0]?.periodKey).toBe(istMonthKey(-2));
		expect(charges[1]?.periodKey).toBe(istMonthKey(-1));
		expect(charges[2]?.periodKey).toBe(istMonthKey());
		const daysInStartMonth = new Date(
			Date.UTC(
				Number(istMonthKey(-2).slice(0, 4)),
				Number(istMonthKey(-2).slice(5)),
				0,
			),
		).getUTCDate();
		// First period: from the 17th to the month end, inclusive (R4).
		expect(charges[0]?.amount).toBe(
			prorated(RENT, daysInStartMonth - 17 + 1, daysInStartMonth),
		);
		expect(charges[1]?.amount).toBe(RENT);
		expect(charges[2]?.amount).toBe(RENT);
	});

	it("a full payment reconciles both ledgers to zero", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		const lease = await singleLease(
			ownerId,
			tenantId,
			propertyId,
			istMonthStart(),
		);
		const api = clients(ownerId);
		const { payment } = await api.createPayment({
			leaseId: lease.id,
			amount: RENT,
			paymentDate: PAYMENT_DATE,
			type: PAYMENT_TYPES.RENT,
			idempotencyKey: crypto.randomUUID(),
		});

		const allocations = await db
			.select()
			.from(rentAllocations)
			.where(eq(rentAllocations.paymentId, payment.id));
		expect(allocations).toHaveLength(1);
		expect(allocations[0]?.amount).toBe(RENT);
		const { period } = await expectReconciled(lease.id);
		expect(period).toBe(0);
	});

	it("a partial payment reconciles both ledgers (C01 R8)", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		const lease = await singleLease(
			ownerId,
			tenantId,
			propertyId,
			istMonthStart(),
		);
		const api = clients(ownerId);
		await api.createPayment({
			leaseId: lease.id,
			amount: 50_000,
			paymentDate: PAYMENT_DATE,
			type: PAYMENT_TYPES.RENT,
			idempotencyKey: crypto.randomUUID(),
		});

		const { period } = await expectReconciled(lease.id);
		expect(period).toBe(100_000);
	});

	it("accepts prepay into the next period up to the R6 cap and refuses beyond it", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		const lease = await singleLease(
			ownerId,
			tenantId,
			propertyId,
			istMonthStart(),
		);
		const api = clients(ownerId);
		// Beyond outstanding + one future period: refused, nothing written.
		await expect(
			api.createPayment({
				leaseId: lease.id,
				amount: 2 * RENT + 1,
				paymentDate: PAYMENT_DATE,
				type: PAYMENT_TYPES.RENT,
				idempotencyKey: crypto.randomUUID(),
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		const refused = await db
			.select({ id: payments.id })
			.from(payments)
			.where(eq(payments.leaseId, lease.id));
		expect(refused).toHaveLength(0);

		// Within the cap: the surplus prepays the next period's charge (R6/R7).
		await api.createPayment({
			leaseId: lease.id,
			amount: RENT + 1,
			paymentDate: PAYMENT_DATE,
			type: PAYMENT_TYPES.RENT,
			idempotencyKey: crypto.randomUUID(),
		});
		const state = await expectReconciled(lease.id);
		expect(state.charges).toHaveLength(2);
		// Current period settled; 1 paise of the surplus sits on next period.
		expect(state.period).toBe(RENT - 1);
		const futureKey = istMonthKey(1);
		const future = state.charges.find((c) => c.periodKey === futureKey);
		expect(future?.amount).toBe(RENT);
	});

	it("a rent discount settles the oldest charge in both ledgers", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		const lease = await singleLease(
			ownerId,
			tenantId,
			propertyId,
			istMonthStart(),
		);
		const api = clients(ownerId);
		const { credit } = await api.createCredit({
			leaseId: lease.id,
			type: "discount",
			amount: -50_000,
			reason: "C04 dual-write discount test",
			idempotencyKey: crypto.randomUUID(),
		});
		const allocations = await db
			.select()
			.from(rentAllocations)
			.where(eq(rentAllocations.creditId, credit.id));
		expect(allocations).toHaveLength(1);
		expect(allocations[0]?.amount).toBe(50_000); // sign inversion (C02)
		const { period } = await expectReconciled(lease.id);
		expect(period).toBe(100_000);
	});

	it("voiding a payment reopens the charge in both ledgers", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		const lease = await singleLease(
			ownerId,
			tenantId,
			propertyId,
			istMonthStart(),
		);
		const api = clients(ownerId);
		const { payment } = await api.createPayment({
			leaseId: lease.id,
			amount: RENT,
			paymentDate: PAYMENT_DATE,
			type: PAYMENT_TYPES.RENT,
			idempotencyKey: crypto.randomUUID(),
		});
		await api.voidPayment({ id: payment.id, reason: "C04 void test" });

		const { period } = await expectReconciled(lease.id);
		expect(period).toBe(RENT);
	});

	it("reversing a credit restores both ledgers", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		const lease = await singleLease(
			ownerId,
			tenantId,
			propertyId,
			istMonthStart(),
		);
		const api = clients(ownerId);
		const { credit } = await api.createCredit({
			leaseId: lease.id,
			type: "discount",
			amount: -50_000,
			reason: "C04 reversal test discount",
			idempotencyKey: crypto.randomUUID(),
		});
		await api.reverseCredit({ creditId: credit.id });

		const { period } = await expectReconciled(lease.id);
		expect(period).toBe(RENT);
	});

	it("a group settlement allocates every lease's payment FIFO", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		// Combined agreement, backdated one month: each lease holds two
		// charges (last month + current). Since the C08 cutover the group
		// settles each lease's full PERIOD outstanding (both months), which
		// the lifetime model never tracked — that difference was the gap.
		const started = new Date(istMonthStart(-1));
		const [unitA, unitB] = await db
			.insert(units)
			.values([
				{
					id: crypto.randomUUID(),
					propertyId,
					unitNumber: "C04-GA",
					type: UNIT_TYPES.ONEBHK,
					baseRent: RENT,
					status: UNIT_STATUSES.AVAILABLE,
				},
				{
					id: crypto.randomUUID(),
					propertyId,
					unitNumber: "C04-GB",
					type: UNIT_TYPES.ONEBHK,
					baseRent: RENT,
					status: UNIT_STATUSES.AVAILABLE,
				},
			])
			.returning();
		createdUnitIds.push(unitA?.id as string, unitB?.id as string);
		const result = await clients(ownerId).createCombinedLease({
			tenantId,
			startDate: started,
			endDate: new Date("2027-09-01T00:00:00.000Z"),
			units: [
				{ unitId: unitA?.id as string, rent: RENT },
				{ unitId: unitB?.id as string, rent: RENT },
			],
		});
		const agreementId = result.leases[0]?.agreementId as string;
		createdAgreementIds.push(agreementId);
		const groupLeases = await db
			.select({ id: leases.id })
			.from(leases)
			.where(eq(leases.agreementId, agreementId));
		createdLeaseIds.push(...groupLeases.map((l) => l.id));

		// Both leases accrued two charges at creation (R13).
		for (const l of groupLeases) {
			const state = await outstanding(l.id);
			expect(state.charges).toHaveLength(2);
		}

		const api = clients(ownerId);
		const { payments: groupPayments } = await api.createAgreementPayment({
			agreementId,
			paymentDate: PAYMENT_DATE,
			paymentMethods: "upi",
			idempotencyKey: crypto.randomUUID(),
		});
		expect(groupPayments).toHaveLength(2);

		// The group settles each lease's period outstanding in full: the
		// payment equals both months and pours FIFO into every charge.
		for (const payment of groupPayments) {
			expect(payment.amount).toBe(2 * RENT);
			const after = await outstanding(payment.leaseId);
			expect(after.period).toBe(0);
			const periodAllocations = await db
				.select({
					periodKey: rentCharges.periodKey,
					amount: rentAllocations.amount,
				})
				.from(rentAllocations)
				.innerJoin(rentCharges, eq(rentAllocations.chargeId, rentCharges.id))
				.where(eq(rentAllocations.paymentId, payment.id))
				.orderBy(rentCharges.periodKey);
			expect(periodAllocations).toHaveLength(2);
			expect(periodAllocations[0]?.periodKey).toBe(istMonthKey(-1));
			expect(periodAllocations[1]?.periodKey).toBe(istMonthKey());
		}
	});

	it("a combined-bill settlement allocates only the rent leg", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		const lease = await singleLease(
			ownerId,
			tenantId,
			propertyId,
			istMonthStart(),
		);
		const [utility] = await db
			.insert(utilities)
			.values({
				leaseId: lease.id,
				utilityType: "electricity",
				previousReadingDate: new Date("2026-08-01T00:00:00.000Z"),
				currentReadingDate: new Date("2026-09-01T00:00:00.000Z"),
				previousReading: 0,
				currentReading: 10,
				unitsUsed: 10,
				ratePerUnit: 1000,
				fixedCharge: 0,
				totalAmount: 10_000,
				isPaid: false,
			})
			.returning();
		const api = clients(ownerId);
		const { payments: allocations } = await api.createCombinedBillPayment({
			leaseId: lease.id,
			utilityIds: [utility?.id as string],
			paymentDate: PAYMENT_DATE,
			paymentMethods: "upi",
			idempotencyKey: crypto.randomUUID(),
		});
		const rentLegs = allocations.filter((p) => p.type === PAYMENT_TYPES.RENT);
		expect(rentLegs).toHaveLength(1);
		const rentLegAllocations = await db
			.select({ amount: rentAllocations.amount })
			.from(rentAllocations)
			.where(eq(rentAllocations.paymentId, rentLegs[0]?.id as string));
		expect(rentLegAllocations[0]?.amount).toBe(RENT);
		await expectReconciled(lease.id);
	});
});
