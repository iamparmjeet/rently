// H04 cash-refund semantics. Per the AGENTS.md test rule, each case pins a
// Fix-Plan H04 acceptance contract. Owner decision (2026-09-07): a "Refund
// (cash back)" credit is only honest on a fully paid bill — on an unpaid bill
// it reduced the due while claiming cash moved, with no cash-outflow entry.
// So refund requires a settled bill (bounded by what was collected) and
// adjust requires an outstanding due (the existing amount bound already
// refuses adjust on a settled bill — pinned as a control).
import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import { CREDIT_TYPES } from "@rently/db/constants/payment-constants";
import {
	LEASE_STATUSES,
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

vi.mock("@rently/email", () => ({
	sendAgreementPaymentReceiptEmail: vi.fn(),
	sendPaymentReceiptEmail: vi.fn(),
	sendUtilityBillEmail: vi.fn(),
}));

import { createCredit, reverseCredit } from "../rent/credit";
import { createPayment } from "../rent/payment";
import { recordUtilityPayment } from "../rent/utility";

const db = createDb();

const createdUserIds: string[] = [];
const createdProfileIds: string[] = [];
const createdPropertyIds: string[] = [];
const createdUnitIds: string[] = [];
const createdLeaseIds: string[] = [];

const RENT = 100_000;
const BILL_TOTAL = 50_000;

function monthStartUtc() {
	const now = new Date();
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function clients(ownerId: string) {
	mocks.getSession.mockResolvedValue({
		user: { id: ownerId, role: "owner" },
		session: { id: "h04-session" },
	});
	const context = { db, headers: new Headers() } as never;
	return createRouterClient(
		{ createCredit, createPayment, recordUtilityPayment, reverseCredit },
		{ context },
	);
}

async function ownerLease() {
	const ownerId = crypto.randomUUID();
	createdUserIds.push(ownerId);
	await db.insert(user).values({
		id: ownerId,
		name: "H04 Owner",
		email: `${ownerId}@test.keyhq.invalid`,
		role: "owner",
	});
	const tenantId = crypto.randomUUID();
	createdUserIds.push(tenantId);
	await db.insert(user).values({
		id: tenantId,
		name: "H04 Tenant",
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
		name: "H04 Property",
		address: "1 H04 Road, Mumbai",
		type: PROPERTY_TYPES.RESIDENTIAL,
	});
	const unitId = crypto.randomUUID();
	createdUnitIds.push(unitId);
	await db.insert(units).values({
		id: unitId,
		propertyId,
		unitNumber: `H04-${unitId.slice(0, 4)}`,
		type: UNIT_TYPES.ONEBHK,
		baseRent: RENT,
		status: UNIT_STATUSES.OCCUPIED,
	});
	const leaseId = crypto.randomUUID();
	createdLeaseIds.push(leaseId);
	await db.insert(leases).values({
		id: leaseId,
		unitId,
		tenantId,
		startDate: monthStartUtc(),
		endDate: null,
		rent: RENT,
		status: LEASE_STATUSES.ACTIVE,
	});
	return { ownerId, leaseId };
}

async function unpaidBill(leaseId: string) {
	const [bill] = await db
		.insert(utilities)
		.values({
			leaseId,
			utilityType: "electricity",
			previousReading: 0,
			currentReading: 100,
			previousReadingDate: monthStartUtc(),
			currentReadingDate: new Date(),
			unitsUsed: 100,
			ratePerUnit: 400,
			fixedCharge: 10000,
			totalAmount: BILL_TOTAL,
			isPaid: false,
		})
		.returning({ id: utilities.id });
	return bill?.id as string;
}

async function creditCount(leaseId: string) {
	return db
		.select({ id: billCredits.id })
		.from(billCredits)
		.where(eq(billCredits.leaseId, leaseId));
}

afterEach(async () => {
	if (createdLeaseIds.length > 0) {
		// C04/C05: period ledger first, then credits/payments/utilities/leases.
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
	createdUserIds.length = 0;
	createdProfileIds.length = 0;
	createdPropertyIds.length = 0;
	createdUnitIds.length = 0;
	createdLeaseIds.length = 0;
	mocks.getSession.mockReset();
});

describe("H04 refund/adjust pairing", () => {
	it("refuses a cash refund on an unpaid utility bill and writes nothing", async () => {
		const { ownerId, leaseId } = await ownerLease();
		const utilityId = await unpaidBill(leaseId);
		const api = clients(ownerId);
		await expect(
			api.createCredit({
				leaseId,
				utilityId,
				type: CREDIT_TYPES.DISCOUNT,
				amount: -10_000,
				reason: "H04 refund on unpaid bill must fail",
				appliedAs: "refund",
				idempotencyKey: crypto.randomUUID(),
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(creditCount(leaseId)).resolves.toHaveLength(0);
	});

	it("records a cash refund on a fully paid utility bill", async () => {
		const { ownerId, leaseId } = await ownerLease();
		const utilityId = await unpaidBill(leaseId);
		const api = clients(ownerId);
		await api.recordUtilityPayment({
			utilityId,
			leaseId,
			amount: BILL_TOTAL,
			paymentMethod: "upi",
			receivedAt: new Date().toISOString(),
			idempotencyKey: crypto.randomUUID(),
		});
		const { credit } = await api.createCredit({
			leaseId,
			utilityId,
			type: CREDIT_TYPES.DISCOUNT,
			amount: -10_000,
			reason: "H04 cash returned for settled bill",
			appliedAs: "refund",
			idempotencyKey: crypto.randomUUID(),
		});
		expect(credit.appliedAs).toBe("refund");
		expect(credit.refundPaymentId).toEqual(expect.any(String));
		const [refund] = await db
			.select({
				amount: payments.amount,
				type: payments.type,
				utilityId: payments.utilityId,
			})
			.from(payments)
			.where(eq(payments.id, credit.refundPaymentId as string));
		expect(refund).toMatchObject({
			amount: -10_000,
			type: "refund",
			utilityId,
		});
		await expect(creditCount(leaseId)).resolves.toHaveLength(1);
	});

	it("refuses a cash refund on an unsettled rent balance and writes nothing", async () => {
		const { ownerId, leaseId } = await ownerLease();
		const api = clients(ownerId);
		await expect(
			api.createCredit({
				leaseId,
				type: CREDIT_TYPES.DISCOUNT,
				amount: -10_000,
				reason: "H04 refund on unpaid rent must fail",
				appliedAs: "refund",
				idempotencyKey: crypto.randomUUID(),
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(creditCount(leaseId)).resolves.toHaveLength(0);
	});

	it("records a cash refund on fully settled rent", async () => {
		const { ownerId, leaseId } = await ownerLease();
		const api = clients(ownerId);
		await api.createPayment({
			leaseId,
			amount: RENT,
			paymentDate: new Date(),
			type: PAYMENT_TYPES.RENT,
			idempotencyKey: crypto.randomUUID(),
		});
		const { credit } = await api.createCredit({
			leaseId,
			type: CREDIT_TYPES.DISCOUNT,
			amount: -10_000,
			reason: "H04 cash returned for settled rent",
			appliedAs: "refund",
			idempotencyKey: crypto.randomUUID(),
		});
		expect(credit.appliedAs).toBe("refund");
		expect(credit.refundPaymentId).toEqual(expect.any(String));
		const [refund] = await db
			.select({ amount: payments.amount, type: payments.type })
			.from(payments)
			.where(eq(payments.id, credit.refundPaymentId as string));
		expect(refund).toMatchObject({ amount: -10_000, type: "refund" });
		await expect(creditCount(leaseId)).resolves.toHaveLength(1);
	});

	it("still refuses a bill reduction on a fully paid bill (existing bound)", async () => {
		const { ownerId, leaseId } = await ownerLease();
		const utilityId = await unpaidBill(leaseId);
		const api = clients(ownerId);
		await api.recordUtilityPayment({
			utilityId,
			leaseId,
			amount: BILL_TOTAL,
			paymentMethod: "upi",
			receivedAt: new Date().toISOString(),
			idempotencyKey: crypto.randomUUID(),
		});
		await expect(
			api.createCredit({
				leaseId,
				utilityId,
				type: CREDIT_TYPES.DISCOUNT,
				amount: -10_000,
				reason: "H04 adjust on paid bill must fail",
				appliedAs: "adjust",
				idempotencyKey: crypto.randomUUID(),
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(creditCount(leaseId)).resolves.toHaveLength(0);
	});

	it("reverses a cash refund credit and creates one positive payment reversal linked to it", async () => {
		const { ownerId, leaseId } = await ownerLease();
		const utilityId = await unpaidBill(leaseId);
		const api = clients(ownerId);
		await api.recordUtilityPayment({
			utilityId,
			leaseId,
			amount: BILL_TOTAL,
			paymentMethod: "upi",
			receivedAt: new Date().toISOString(),
			idempotencyKey: crypto.randomUUID(),
		});
		const { credit } = await api.createCredit({
			leaseId,
			utilityId,
			type: CREDIT_TYPES.DISCOUNT,
			amount: -10_000,
			reason: "H04 cash returned for settled bill",
			appliedAs: "refund",
			idempotencyKey: crypto.randomUUID(),
		});

		expect(credit.refundPaymentId).toBeDefined();

		const { reversal } = await api.reverseCredit({
			creditId: credit.id,
		});

		expect(reversal).toBeDefined();

		const recoveryRows = await db
			.select({
				amount: payments.amount,
				type: payments.type,
				reversesPaymentId: payments.reversesPaymentId,
			})
			.from(payments)
			.where(eq(payments.reversesPaymentId, credit.refundPaymentId as string));

		expect(recoveryRows).toHaveLength(1);
		expect(recoveryRows[0]).toMatchObject({
			amount: 10_000,
			type: "reversal",
			reversesPaymentId: credit.refundPaymentId,
		});
	}, 30000);
});
