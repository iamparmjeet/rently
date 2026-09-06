// C05 read-model tests. Per the AGENTS.md test rule, each case pins a
// Fix-Plan C05 acceptance contract and the regression it prevents:
// - partial payment: the read model must report the outstanding remainder,
//   not a binary paid/unpaid state (the lifetime defect R10 documents);
// - previous-month arrears on a backdated lease: overdue and current rent
//   must be separable and the accrued gap (period ledger ahead of the
//   lifetime model) must be visible — hiding it would let C06/C07 screens
//   show a backdated tenant as square;
// - advance/prepaid future period: a future charge that is fully allocated
//   must read as paid/not overdue and never inflate totalRentDue (writers
//   still refuse advances, so the state is fixture-inserted);
// - multi-unit agreement: one read must return every lease of the agreement
//   with per-lease period identity and distinct per-lease states;
// - reversal: a voided payment must reopen the charge and net both paid
//   streams to zero (B12 attribution carried into the read model);
// - owner/tenant scoping (E01-class): a balance read is a financial read —
//   an owner must never see another owner's lease even for a shared tenant,
//   a tenant only their own leases, and no supervisory access exists;
// - accrual-before-read: during the lazy-accrual phase a lease idle across a
//   month boundary has no current-period charge yet; the read model must
//   ensure the charge set (R2–R5) or screens would show a false zero.
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
	payments,
	properties,
	rentAllocations,
	rentCharges,
	tenantProfiles,
	units,
	utilities,
} from "@rently/db/schema/schema";
import { eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getLocalDateKey, getLocalPeriodKey } from "../helpers/rent-cycle";
import { getPeriodBalance } from "../rent/balance";
import { createCredit } from "../rent/credit";
import { createCombinedLease, createLease } from "../rent/lease";
import { createPayment, voidPayment } from "../rent/payment";

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

const db = createDb();

const createdUserIds: string[] = [];
const createdProfileIds: string[] = [];
const createdPropertyIds: string[] = [];
const createdUnitIds: string[] = [];
const createdLeaseIds: string[] = [];
const createdAgreementIds: string[] = [];

const RENT = 150_000;
const PAYMENT_DATE = new Date("2026-09-06T00:00:00.000Z");

// One shared router client: the authenticated caller is chosen per call via
// asSession (the getSession mock is module-global, so per-call selection is
// the only correct pattern — creating "owner clients" would silently leak the
// last mock into earlier clients).
const api = createRouterClient(
	{
		getPeriodBalance,
		createLease,
		createCombinedLease,
		createPayment,
		createCredit,
		voidPayment,
	},
	{ context: { db, headers: new Headers() } as never },
);

function asSession(callerId: string, role: string) {
	mocks.getSession.mockResolvedValue({
		user: { id: callerId, role },
		session: { id: "c05-session" },
	});
}

async function insertPerson(name: string, role: string) {
	const id = crypto.randomUUID();
	createdUserIds.push(id);
	await db.insert(user).values({
		id,
		name,
		email: `${id}@test.keyhq.invalid`,
		role,
	});
	return id;
}

async function insertProfile(userId: string, ownerId: string) {
	const id = crypto.randomUUID();
	createdProfileIds.push(id);
	await db.insert(tenantProfiles).values({ id, userId, createdById: ownerId });
}

async function insertProperty(ownerId: string, name: string) {
	const id = crypto.randomUUID();
	createdPropertyIds.push(id);
	await db.insert(properties).values({
		id,
		ownerId,
		name,
		address: `1 ${name} Road, Mumbai`,
		type: PROPERTY_TYPES.RESIDENTIAL,
	});
	return id;
}

async function insertUnit(propertyId: string, unitNumber: string) {
	const id = crypto.randomUUID();
	createdUnitIds.push(id);
	await db.insert(units).values({
		id,
		propertyId,
		unitNumber,
		type: UNIT_TYPES.ONEBHK,
		baseRent: RENT,
		status: UNIT_STATUSES.AVAILABLE,
	});
	return id;
}

function istMonthKey(offsetMonths = 0) {
	const ist = new Date(Date.now() + 5.5 * 3_600_000);
	const target = new Date(
		Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() + offsetMonths, 1),
	);
	return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}`;
}

function istMonthStart(offsetMonths = 0) {
	return new Date(`${istMonthKey(offsetMonths)}-01T00:00:00.000Z`);
}

function daysInMonth(periodKey: string) {
	return new Date(
		Date.UTC(Number(periodKey.slice(0, 4)), Number(periodKey.slice(5)), 0),
	).getUTCDate();
}

// Clamped due date (R3) for a due day in a period.
function dueDateKey(periodKey: string, dueDay: number) {
	return `${periodKey}-${String(Math.min(dueDay, daysInMonth(periodKey))).padStart(2, "0")}`;
}

async function readBalance(
	callerId: string,
	role: string,
	input: { leaseId?: string; agreementId?: string },
) {
	asSession(callerId, role);
	return api.getPeriodBalance(input);
}

async function balanceForLease(
	callerId: string,
	role: string,
	leaseId: string,
) {
	const result = await readBalance(callerId, role, { leaseId });
	expect(result.scope).toBe("lease");
	expect(result.leases).toHaveLength(1);
	return result.leases[0]!;
}

afterEach(async () => {
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

describe("C05 period balance read model", () => {
	it("reports a partial payment, a rent credit, and outstanding utilities from one model", async () => {
		const ownerId = await insertPerson("C05 Owner", "owner");
		const tenantId = await insertPerson("C05 Tenant", "tenant");
		await insertProfile(tenantId, ownerId);
		const propertyId = await insertProperty(ownerId, "C05 Property");
		const unitId = await insertUnit(propertyId, "C05-P");
		asSession(ownerId, "owner");
		const { lease } = await api.createLease({
			tenantId,
			unitId,
			startDate: istMonthStart(),
			endDate: new Date("2027-09-01T00:00:00.000Z"),
			rent: RENT,
		});
		createdLeaseIds.push(lease.id);
		createdAgreementIds.push(lease.agreementId as string);

		await api.createPayment({
			leaseId: lease.id,
			amount: 50_000,
			paymentDate: PAYMENT_DATE,
			type: PAYMENT_TYPES.RENT,
			idempotencyKey: crypto.randomUUID(),
		});
		await api.createCredit({
			leaseId: lease.id,
			type: "discount",
			amount: -50_000,
			reason: "C05 read model discount",
			idempotencyKey: crypto.randomUUID(),
		});
		await db.insert(utilities).values({
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
		});

		const balance = await balanceForLease(ownerId, "owner", lease.id);

		// One current-period charge of the full rent; 50k paid + 50k credited.
		expect(balance.charges).toHaveLength(1);
		const charge = balance.charges[0]!;
		expect(charge.periodKey).toBe(getLocalPeriodKey(new Date()));
		expect(charge.amount).toBe(RENT);
		expect(charge.outstanding).toBe(50_000);
		expect(charge.isPaid).toBe(false);
		expect(charge.isFuture).toBe(false);
		expect(balance.currentRentDue).toBe(50_000);
		expect(balance.totalRentDue).toBe(50_000);
		expect(balance.paid.lifetime).toBe(50_000);
		expect(balance.paid.period).toBe(50_000);
		expect(balance.credits.total).toBe(-50_000);
		expect(balance.credits.allocatedToCharges).toBe(50_000);
		expect(balance.utilities.items).toHaveLength(1);
		expect(balance.utilities.items[0]?.due).toBe(10_000);
		expect(balance.utilities.totalDue).toBe(10_000);

		// Overdue follows the clamped due date (dueDay falls back to the start
		// day = the 1st), asserted via the rule so the test is day-of-month safe.
		const expectedOverdue =
			charge.dueDate < getLocalDateKey(new Date()) ? 50_000 : 0;
		expect(balance.overdueRent).toBe(expectedOverdue);
	});

	it("separates previous-month arrears from current rent and shows the accrued gap on a backdated lease", async () => {
		const ownerId = await insertPerson("C05 Owner", "owner");
		const tenantId = await insertPerson("C05 Tenant", "tenant");
		await insertProfile(tenantId, ownerId);
		const propertyId = await insertProperty(ownerId, "C05 Arrears");
		const unitId = await insertUnit(propertyId, "C05-A");
		// Backdated registration (R13) with an explicit due day: last month's
		// due date has certainly passed, today's may not have.
		asSession(ownerId, "owner");
		const { lease } = await api.createLease({
			tenantId,
			unitId,
			startDate: istMonthStart(-1),
			endDate: new Date("2027-09-01T00:00:00.000Z"),
			rent: RENT,
			rentDueDate: 10,
		});
		createdLeaseIds.push(lease.id);
		createdAgreementIds.push(lease.agreementId as string);

		const balance = await balanceForLease(ownerId, "owner", lease.id);
		const previousKey = istMonthKey(-1);
		const currentKey = getLocalPeriodKey(new Date());

		expect(balance.charges).toHaveLength(2);
		expect(balance.charges.map((c) => c.periodKey)).toEqual([
			previousKey,
			currentKey,
		]);
		for (const charge of balance.charges) {
			expect(charge.amount).toBe(RENT);
			expect(charge.outstanding).toBe(RENT);
		}
		expect(balance.currentRentDue).toBe(RENT);
		expect(balance.totalRentDue).toBe(2 * RENT);
		// Last month is overdue for certain; the current period only if its
		// clamped due date (the 10th) has already passed.
		const currentDue = dueDateKey(currentKey, 10);
		const expectedOverdue =
			currentDue < getLocalDateKey(new Date()) ? 2 * RENT : RENT;
		expect(balance.overdueRent).toBe(expectedOverdue);
		expect(balance.currentPeriodDueDate).toBe(currentDue);
	});

	it("represents a prepaid future period as paid, not overdue, and not part of totalRentDue", async () => {
		const ownerId = await insertPerson("C05 Owner", "owner");
		const tenantId = await insertPerson("C05 Tenant", "tenant");
		await insertProfile(tenantId, ownerId);
		const propertyId = await insertProperty(ownerId, "C05 Advance");
		const unitId = await insertUnit(propertyId, "C05-V");
		asSession(ownerId, "owner");
		const { lease } = await api.createLease({
			tenantId,
			unitId,
			startDate: istMonthStart(),
			endDate: new Date("2027-09-01T00:00:00.000Z"),
			rent: RENT,
		});
		createdLeaseIds.push(lease.id);
		createdAgreementIds.push(lease.agreementId as string);

		// Settle the current period through the writer first (the direct-inserted
		// advance payment below already counts in the lifetime ledger, so the
		// order matters). Writers still refuse advances (C04); the approved R6
		// state is fixture-inserted: next period's charge, fully settled by a
		// payment.
		await api.createPayment({
			leaseId: lease.id,
			amount: RENT,
			paymentDate: PAYMENT_DATE,
			type: PAYMENT_TYPES.RENT,
			idempotencyKey: crypto.randomUUID(),
		});
		const futureKey = istMonthKey(1);
		const [futureCharge] = await db
			.insert(rentCharges)
			.values({
				leaseId: lease.id,
				periodKey: futureKey,
				dueDate: dueDateKey(futureKey, 1),
				amount: RENT,
			})
			.returning();
		const [advancePayment] = await db
			.insert(payments)
			.values({
				id: crypto.randomUUID(),
				leaseId: lease.id,
				amount: RENT,
				paymentDate: PAYMENT_DATE,
				type: PAYMENT_TYPES.RENT,
			})
			.returning();
		await db.insert(rentAllocations).values({
			chargeId: futureCharge!.id,
			paymentId: advancePayment!.id,
			amount: RENT,
		});

		const balance = await balanceForLease(ownerId, "owner", lease.id);

		const future = balance.charges.find((c) => c.periodKey === futureKey)!;
		const current = balance.charges.find(
			(c) => c.periodKey === getLocalPeriodKey(new Date()),
		)!;
		expect(future.isFuture).toBe(true);
		expect(future.isPaid).toBe(true);
		expect(future.outstanding).toBe(0);
		expect(future.isOverdue).toBe(false);
		expect(current.isPaid).toBe(true);
		expect(balance.currentRentDue).toBe(0);
		expect(balance.overdueRent).toBe(0);
		expect(balance.totalRentDue).toBe(0);
		expect(balance.paid.lifetime).toBe(2 * RENT);
		expect(balance.paid.period).toBe(2 * RENT);
	});

	it("returns every lease of an agreement with per-lease period identity", async () => {
		const ownerId = await insertPerson("C05 Owner", "owner");
		const tenantId = await insertPerson("C05 Tenant", "tenant");
		await insertProfile(tenantId, ownerId);
		const propertyId = await insertProperty(ownerId, "C05 Multi");
		const unitA = await insertUnit(propertyId, "C05-MA");
		const unitB = await insertUnit(propertyId, "C05-MB");
		asSession(ownerId, "owner");
		const { leases: combinedLeases } = await api.createCombinedLease({
			tenantId,
			startDate: istMonthStart(),
			endDate: new Date("2027-09-01T00:00:00.000Z"),
			units: [
				{ unitId: unitA, rent: RENT },
				{ unitId: unitB, rent: RENT },
			],
		});
		const agreementId = combinedLeases[0]!.agreementId as string;
		createdLeaseIds.push(...combinedLeases.map((l) => l.id));
		createdAgreementIds.push(agreementId);
		// Pay one unit fully, leave the other untouched: the agreement read
		// must keep the two states distinct.
		await api.createPayment({
			leaseId: combinedLeases[0]!.id,
			amount: RENT,
			paymentDate: PAYMENT_DATE,
			type: PAYMENT_TYPES.RENT,
			idempotencyKey: crypto.randomUUID(),
		});

		const result = await readBalance(ownerId, "owner", { agreementId });
		expect(result.scope).toBe("agreement");
		expect(result.leases).toHaveLength(2);

		const paid = result.leases.find(
			(l) => l.leaseId === combinedLeases[0]!.id,
		)!;
		const unpaid = result.leases.find(
			(l) => l.leaseId === combinedLeases[1]!.id,
		)!;
		expect(paid.currentRentDue).toBe(0);
		expect(paid.totalRentDue).toBe(0);
		expect(paid.paid.period).toBe(RENT);
		expect(unpaid.currentRentDue).toBe(RENT);
		expect(unpaid.totalRentDue).toBe(RENT);
		expect(unpaid.paid.period).toBe(0);
		for (const entry of result.leases) {
			expect(entry.currentPeriodKey).toBe(getLocalPeriodKey(new Date()));
			expect(entry.charges).toHaveLength(1);
		}
	});

	it("a voided payment reopens the charge and nets both paid streams to zero", async () => {
		const ownerId = await insertPerson("C05 Owner", "owner");
		const tenantId = await insertPerson("C05 Tenant", "tenant");
		await insertProfile(tenantId, ownerId);
		const propertyId = await insertProperty(ownerId, "C05 Reversal");
		const unitId = await insertUnit(propertyId, "C05-R");
		asSession(ownerId, "owner");
		const { lease } = await api.createLease({
			tenantId,
			unitId,
			startDate: istMonthStart(),
			endDate: new Date("2027-09-01T00:00:00.000Z"),
			rent: RENT,
		});
		createdLeaseIds.push(lease.id);
		createdAgreementIds.push(lease.agreementId as string);
		const { payment } = await api.createPayment({
			leaseId: lease.id,
			amount: RENT,
			paymentDate: PAYMENT_DATE,
			type: PAYMENT_TYPES.RENT,
			idempotencyKey: crypto.randomUUID(),
		});
		await api.voidPayment({ id: payment.id, reason: "C05 reversal test" });

		const balance = await balanceForLease(ownerId, "owner", lease.id);
		const charge = balance.charges[0]!;
		expect(charge.outstanding).toBe(RENT);
		expect(charge.isPaid).toBe(false);
		expect(balance.paid.lifetime).toBe(0);
		expect(balance.paid.period).toBe(0);
		expect(balance.totalRentDue).toBe(RENT);
	});

	it("scopes balances to the caller: owners by property, tenants by lease, no supervisory access", async () => {
		const ownerA = await insertPerson("C05 Owner A", "owner");
		const ownerB = await insertPerson("C05 Owner B", "owner");
		const sharedTenant = await insertPerson("C05 Shared Tenant", "tenant");
		const tenantB = await insertPerson("C05 Tenant B", "tenant");
		await insertProfile(sharedTenant, ownerA);
		await insertProfile(sharedTenant, ownerB);
		await insertProfile(tenantB, ownerB);
		const propertyA = await insertProperty(ownerA, "C05 Prop A");
		const propertyB = await insertProperty(ownerB, "C05 Prop B");
		const unitA = await insertUnit(propertyA, "C05-SA");
		const unitB1 = await insertUnit(propertyB, "C05-SB1");
		const unitB2 = await insertUnit(propertyB, "C05-SB2");
		// The shared tenant holds a lease under each owner; owner B also has a
		// lease with their own tenant.
		asSession(ownerA, "owner");
		const { lease: leaseA } = await api.createLease({
			tenantId: sharedTenant,
			unitId: unitA,
			startDate: istMonthStart(),
			endDate: new Date("2027-09-01T00:00:00.000Z"),
			rent: RENT,
		});
		asSession(ownerB, "owner");
		const { lease: sharedLeaseB } = await api.createLease({
			tenantId: sharedTenant,
			unitId: unitB1,
			startDate: istMonthStart(),
			endDate: new Date("2027-09-01T00:00:00.000Z"),
			rent: RENT,
		});
		asSession(ownerB, "owner");
		const { lease: leaseB } = await api.createLease({
			tenantId: tenantB,
			unitId: unitB2,
			startDate: istMonthStart(),
			endDate: new Date("2027-09-01T00:00:00.000Z"),
			rent: RENT,
		});
		createdLeaseIds.push(leaseA.id, sharedLeaseB.id, leaseB.id);
		createdAgreementIds.push(
			leaseA.agreementId as string,
			sharedLeaseB.agreementId as string,
			leaseB.agreementId as string,
		);

		// Owner A reads their own lease; never owner B's — not even the shared
		// tenant's lease on B's property (the E01 leak this pins).
		await balanceForLease(ownerA, "owner", leaseA.id);
		await expect(
			readBalance(ownerA, "owner", { leaseId: sharedLeaseB.id }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			readBalance(ownerA, "owner", { leaseId: leaseB.id }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			readBalance(ownerA, "owner", {
				agreementId: leaseB.agreementId as string,
			}),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			readBalance(ownerB, "owner", { leaseId: leaseA.id }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });

		// The shared tenant reads their own leases on both sides, and an
		// agreement read returns only their own leases of that agreement.
		await balanceForLease(sharedTenant, "tenant", leaseA.id);
		await balanceForLease(sharedTenant, "tenant", sharedLeaseB.id);
		const tenantView = await readBalance(sharedTenant, "tenant", {
			agreementId: leaseA.agreementId as string,
		});
		expect(tenantView.leases.map((l) => l.leaseId)).toEqual([leaseA.id]);

		// A tenant cannot read someone else's lease; admins get nothing.
		await expect(
			readBalance(tenantB, "tenant", { leaseId: leaseA.id }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			readBalance(tenantB, "admin", { leaseId: leaseB.id }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("ensures the current-period charge before reading (lazy-accrual phase)", async () => {
		const ownerId = await insertPerson("C05 Owner", "owner");
		const tenantId = await insertPerson("C05 Tenant", "tenant");
		await insertProfile(tenantId, ownerId);
		const propertyId = await insertProperty(ownerId, "C05 Accrual");
		const unitId = await insertUnit(propertyId, "C05-AC");
		asSession(ownerId, "owner");
		const { lease } = await api.createLease({
			tenantId,
			unitId,
			startDate: istMonthStart(),
			endDate: new Date("2027-09-01T00:00:00.000Z"),
			rent: RENT,
		});
		createdLeaseIds.push(lease.id);
		createdAgreementIds.push(lease.agreementId as string);
		// Simulate a lease idle across a month boundary: no operation has
		// accrued this month's charge yet.
		await db.delete(rentCharges).where(eq(rentCharges.leaseId, lease.id));

		const balance = await balanceForLease(ownerId, "owner", lease.id);
		expect(balance.charges).toHaveLength(1);
		expect(balance.charges[0]?.periodKey).toBe(getLocalPeriodKey(new Date()));
		expect(balance.currentRentDue).toBe(RENT);
		expect(balance.totalRentDue).toBe(RENT);
	});

	it("all-scope returns exactly the caller's visible leases, empty portfolio included (C06 dashboards)", async () => {
		// Regression: the all-scope is the owner dashboard's data source — a
		// cross-owner leak here would broadcast every landlord's arrears to one
		// page, and a FORBIDDEN on an empty portfolio would blank the dashboard
		// of every new owner.
		const ownerA = await insertPerson("C05 All Owner A", "owner");
		const ownerB = await insertPerson("C05 All Owner B", "owner");
		const tenantA = await insertPerson("C05 All Tenant A", "tenant");
		const tenantB = await insertPerson("C05 All Tenant B", "tenant");
		await insertProfile(tenantA, ownerA);
		await insertProfile(tenantB, ownerB);
		const propertyA = await insertProperty(ownerA, "C05 All Prop A");
		const propertyB = await insertProperty(ownerB, "C05 All Prop B");
		const unitA = await insertUnit(propertyA, "C05-ALA");
		const unitB = await insertUnit(propertyB, "C05-ALB");
		asSession(ownerA, "owner");
		const { lease: leaseA } = await api.createLease({
			tenantId: tenantA,
			unitId: unitA,
			startDate: istMonthStart(),
			endDate: new Date("2027-09-01T00:00:00.000Z"),
			rent: RENT,
		});
		asSession(ownerB, "owner");
		const { lease: leaseB } = await api.createLease({
			tenantId: tenantB,
			unitId: unitB,
			startDate: istMonthStart(),
			endDate: new Date("2027-09-01T00:00:00.000Z"),
			rent: RENT,
		});
		createdLeaseIds.push(leaseA.id, leaseB.id);
		createdAgreementIds.push(
			leaseA.agreementId as string,
			leaseB.agreementId as string,
		);

		const ownerView = await readBalance(ownerA, "owner", { all: true });
		expect(ownerView.scope).toBe("all");
		expect(ownerView.leases.map((l) => l.leaseId)).toEqual([leaseA.id]);

		const tenantView = await readBalance(tenantB, "tenant", { all: true });
		expect(tenantView.leases.map((l) => l.leaseId)).toEqual([leaseB.id]);

		// Empty portfolio is a valid empty dashboard state, not an error.
		const emptyOwner = await insertPerson("C05 All Owner C", "owner");
		const emptyView = await readBalance(emptyOwner, "owner", { all: true });
		expect(emptyView.leases).toHaveLength(0);

		// Supervisory roles still get nothing.
		await expect(
			readBalance(tenantB, "admin", { all: true }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
});
