// B11 behavioral tests. Every case pins a contract from the Fix-Plan, not an
// implementation detail:
// - one command = one payment group with server-derived rent + utility legs
//   (prevents a return to the browser's Promise.all partial writes);
// - a failed leg writes nothing (atomicity on both drivers);
// - a bill from another lease can never settle through this command
//   (authorization boundary);
// - an already-settled bill can never be double-settled, and a corrected
//   retry succeeds (business rule + retry path);
// - a same-key retry returns the winner's group with no second receipt
//   (B09 idempotency + receipt-after-commit);
// - a reused key naming different bills conflicts (fingerprint wiring);
// - rent already settled yields a utility-only group (optional rent leg);
// - concurrent individual utility settlement and the combined command
//   serialize with no over-settlement, on node-postgres and the Neon batch
//   path (production driver parity — Fix-Plan acceptance criteria).
import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import {
	PAYMENT_TYPES,
	PROPERTY_TYPES,
	UNIT_STATUSES,
	UNIT_TYPES,
	UTILITY_TYPES,
} from "@rently/db/constants/rent-constants";
import { user } from "@rently/db/schema/auth";
import {
	billCredits,
	leaseAgreements,
	leases,
	paymentGroups,
	payments,
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

vi.mock("@rently/email", () => ({
	sendAgreementPaymentReceiptEmail: vi.fn(),
	sendPaymentReceiptEmail: vi.fn(),
	sendUtilityBillEmail: vi.fn(),
}));

import {
	sendAgreementPaymentReceiptEmail,
	sendPaymentReceiptEmail,
} from "@rently/email";
import { createLease } from "../rent/lease";
import { createCombinedBillPayment, createPayment } from "../rent/payment";
import { recordUtilityPayment } from "../rent/utility";

const db = createDb();

const createdUserIds: string[] = [];
const createdProfileIds: string[] = [];
const createdPropertyIds: string[] = [];
const createdUnitIds: string[] = [];
const createdLeaseIds: string[] = [];
const createdAgreementIds: string[] = [];
const createdUtilityIds: string[] = [];

const UNIT_RENT = 150_000;
const ELECTRIC_AMOUNT = 40_000;
const WATER_AMOUNT = 15_000;
const PAYMENT_DATE = new Date("2026-09-06T00:00:00.000Z");
const RECEIVED_AT = "2026-09-06";

function clients(ownerId: string, database: typeof db = db) {
	mocks.getSession.mockResolvedValue({
		user: { id: ownerId, role: "owner" },
		session: { id: "b11-session" },
	});
	const context = { db: database, headers: new Headers() } as never;
	return createRouterClient(
		{
			createLease,
			createCombinedBillPayment,
			createPayment,
			recordUtilityPayment,
		},
		{ context },
	);
}

async function ownerProperty() {
	const ownerId = crypto.randomUUID();
	createdUserIds.push(ownerId);
	await db.insert(user).values({
		id: ownerId,
		name: "B11 Owner",
		email: `${ownerId}@test.keyhq.invalid`,
		role: "owner",
	});
	const tenantId = crypto.randomUUID();
	createdUserIds.push(tenantId);
	await db.insert(user).values({
		id: tenantId,
		name: "B11 Tenant",
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
		name: "B11 Property",
		address: "1 B11 Road, Mumbai",
		type: PROPERTY_TYPES.RESIDENTIAL,
	});
	return { ownerId, tenantId, propertyId };
}

// One lease under its own agreement wrapper, holding one electricity and one
// water bill — the exact shape the combined-bill dialog submits.
async function leaseWithUtilities(
	ownerId: string,
	tenantId: string,
	propertyId: string,
	unitPrefix: string,
) {
	const [unit] = await db
		.insert(units)
		.values({
			id: crypto.randomUUID(),
			propertyId,
			unitNumber: `${unitPrefix}-U`,
			type: UNIT_TYPES.ONEBHK,
			baseRent: UNIT_RENT,
			status: UNIT_STATUSES.AVAILABLE,
		})
		.returning();
	createdUnitIds.push(unit?.id as string);
	const result = await clients(ownerId).createLease({
		tenantId,
		unitId: unit?.id as string,
		startDate: new Date("2026-09-01T00:00:00.000Z"),
		endDate: new Date("2027-09-01T00:00:00.000Z"),
		rent: UNIT_RENT,
	});
	const leaseId = result.lease.id;
	const agreementId = result.lease.agreementId;
	if (!agreementId) throw new Error("Lease did not create an agreement");
	createdLeaseIds.push(leaseId);
	createdAgreementIds.push(agreementId);

	const createdUtilities = await db
		.insert(utilities)
		.values([
			{
				leaseId,
				utilityType: UTILITY_TYPES.ELECTRICITY,
				previousReadingDate: new Date("2026-08-01T00:00:00.000Z"),
				currentReadingDate: new Date("2026-09-01T00:00:00.000Z"),
				previousReading: 100,
				currentReading: 140,
				unitsUsed: 40,
				ratePerUnit: 1000,
				fixedCharge: 0,
				totalAmount: ELECTRIC_AMOUNT,
				isPaid: false,
			},
			{
				leaseId,
				utilityType: UTILITY_TYPES.WATER,
				previousReadingDate: new Date("2026-08-01T00:00:00.000Z"),
				currentReadingDate: new Date("2026-09-01T00:00:00.000Z"),
				previousReading: 10,
				currentReading: 15,
				unitsUsed: 5,
				ratePerUnit: 2000,
				fixedCharge: 5000,
				totalAmount: WATER_AMOUNT,
				isPaid: false,
			},
		])
		.returning();
	createdUtilityIds.push(...createdUtilities.map((u) => u.id));
	const [electric, water] = createdUtilities;
	return {
		leaseId,
		agreementId,
		electric: electric as { id: string },
		water: water as { id: string },
	};
}

// This shim selects the same supportsBatch branch used by Neon HTTP while
// retaining the disposable local Postgres connection for deterministic tests.
function neonPathDatabase() {
	return new Proxy(db, {
		get(target, property, receiver) {
			if (property === "batch") {
				return (queries: Array<{ getSQL: () => unknown }>) =>
					target.transaction(async (tx) => {
						const results = [];
						for (const query of queries) {
							results.push(await tx.execute(query.getSQL() as never));
						}
						return results;
					});
			}
			return Reflect.get(target, property, receiver);
		},
	});
}

async function groupCount(agreementId: string) {
	const rows = await db
		.select({ id: paymentGroups.id })
		.from(paymentGroups)
		.where(eq(paymentGroups.agreementId, agreementId));
	return rows.length;
}

async function paymentCount(leaseId: string) {
	const rows = await db
		.select({ id: payments.id })
		.from(payments)
		.where(eq(payments.leaseId, leaseId));
	return rows.length;
}

async function utilityLedgerSum(utilityId: string) {
	const rows = await db
		.select({ amount: payments.amount })
		.from(payments)
		.where(eq(payments.utilityId, utilityId));
	return rows.reduce((sum, row) => sum + row.amount, 0);
}

async function utilityPaidFlag(utilityId: string) {
	const [row] = await db
		.select({ isPaid: utilities.isPaid })
		.from(utilities)
		.where(eq(utilities.id, utilityId));
	return row?.isPaid;
}

afterEach(async () => {
	vi.mocked(sendAgreementPaymentReceiptEmail).mockClear();
	vi.mocked(sendPaymentReceiptEmail).mockClear();
	// Payments reference utilities, so they must be removed first.
	if (createdLeaseIds.length > 0) {
		await db
			.delete(billCredits)
			.where(inArray(billCredits.leaseId, createdLeaseIds));
		await db.delete(payments).where(inArray(payments.leaseId, createdLeaseIds));
	}
	if (createdUtilityIds.length > 0) {
		await db
			.delete(billCredits)
			.where(inArray(billCredits.utilityId, createdUtilityIds));
		await db.delete(utilities).where(inArray(utilities.id, createdUtilityIds));
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
	createdUtilityIds.length = 0;
	mocks.getSession.mockReset();
});

describe("B11 atomic combined-bill settlement", () => {
	it("Node records rent plus utilities in one group with one post-commit receipt", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		const { leaseId, electric, water } = await leaseWithUtilities(
			ownerId,
			tenantId,
			propertyId,
			"B11-n1",
		);
		const api = clients(ownerId);

		const { paymentGroup, payments: allocations } =
			await api.createCombinedBillPayment({
				leaseId,
				utilityIds: [electric.id, water.id],
				paymentDate: PAYMENT_DATE,
				paymentMethods: "upi",
				idempotencyKey: crypto.randomUUID(),
			});

		// One group on the lease's agreement; one rent leg at the full due plus
		// one utility leg per bill at its full outstanding amount.
		expect(paymentGroup.agreementId).toBeDefined();
		expect(allocations).toHaveLength(3);
		const rentLegs = allocations.filter((p) => p.type === PAYMENT_TYPES.RENT);
		const utilityLegs = allocations.filter(
			(p) => p.type === PAYMENT_TYPES.UTILITY,
		);
		expect(rentLegs).toHaveLength(1);
		expect(rentLegs[0]?.amount).toBe(UNIT_RENT);
		expect(utilityLegs.map((p) => p.amount).sort((a, b) => a - b)).toEqual([
			WATER_AMOUNT,
			ELECTRIC_AMOUNT,
		]);
		for (const allocation of allocations) {
			expect(allocation.paymentGroupId).toBe(paymentGroup.id);
			expect(allocation.idempotencyKey).toBeUndefined();
		}
		expect(await utilityPaidFlag(electric.id)).toBe(true);
		expect(await utilityPaidFlag(water.id)).toBe(true);
		expect(await groupCount(paymentGroup.agreementId)).toBe(1);

		// Exactly one receipt, sent for the whole group only after commit.
		expect(sendAgreementPaymentReceiptEmail).toHaveBeenCalledTimes(1);
		expect(sendPaymentReceiptEmail).not.toHaveBeenCalled();
	});

	it("Node writes nothing when a selected utility belongs to another lease", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		const { leaseId, agreementId, electric } = await leaseWithUtilities(
			ownerId,
			tenantId,
			propertyId,
			"B11-n2",
		);
		// A second lease owned by the same owner holds the foreign bill.
		const [foreignUnit] = await db
			.insert(units)
			.values({
				id: crypto.randomUUID(),
				propertyId,
				unitNumber: "B11-n2-F",
				type: UNIT_TYPES.ONEBHK,
				baseRent: UNIT_RENT,
				status: UNIT_STATUSES.AVAILABLE,
			})
			.returning();
		createdUnitIds.push(foreignUnit?.id as string);
		const foreignLease = await clients(ownerId).createLease({
			tenantId,
			unitId: foreignUnit?.id as string,
			startDate: new Date("2026-09-01T00:00:00.000Z"),
			endDate: new Date("2027-09-01T00:00:00.000Z"),
			rent: UNIT_RENT,
		});
		createdLeaseIds.push(foreignLease.lease.id);
		createdAgreementIds.push(foreignLease.lease.agreementId as string);
		const [foreignUtility] = await db
			.insert(utilities)
			.values({
				leaseId: foreignLease.lease.id,
				utilityType: UTILITY_TYPES.ELECTRICITY,
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
		createdUtilityIds.push(foreignUtility?.id as string);

		const api = clients(ownerId);
		await expect(
			api.createCombinedBillPayment({
				leaseId,
				utilityIds: [electric.id, foreignUtility?.id as string],
				paymentDate: PAYMENT_DATE,
				paymentMethods: "upi",
				idempotencyKey: crypto.randomUUID(),
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		// The failed leg must not leave a partial settlement behind.
		expect(await groupCount(agreementId)).toBe(0);
		expect(await paymentCount(leaseId)).toBe(0);
		expect(await utilityPaidFlag(electric.id)).toBe(false);
		expect(sendAgreementPaymentReceiptEmail).not.toHaveBeenCalled();
	});

	it("Node writes nothing when a selected utility is already settled, then a fresh retry succeeds", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		const { leaseId, agreementId, electric, water } = await leaseWithUtilities(
			ownerId,
			tenantId,
			propertyId,
			"B11-n4",
		);
		const api = clients(ownerId);
		await api.recordUtilityPayment({
			utilityId: electric.id,
			leaseId,
			amount: ELECTRIC_AMOUNT,
			paymentMethod: "upi",
			receivedAt: RECEIVED_AT,
			idempotencyKey: crypto.randomUUID(),
		});

		await expect(
			api.createCombinedBillPayment({
				leaseId,
				utilityIds: [electric.id, water.id],
				paymentDate: PAYMENT_DATE,
				paymentMethods: "upi",
				idempotencyKey: crypto.randomUUID(),
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(await groupCount(agreementId)).toBe(0);
		// Only the individual payment exists — no partial combined legs.
		expect(await utilityLedgerSum(electric.id)).toBe(ELECTRIC_AMOUNT);
		expect(await utilityLedgerSum(water.id)).toBe(0);

		// Retry naming only the outstanding bill settles the rest.
		const { payments: allocations } = await api.createCombinedBillPayment({
			leaseId,
			utilityIds: [water.id],
			paymentDate: PAYMENT_DATE,
			paymentMethods: "upi",
			idempotencyKey: crypto.randomUUID(),
		});
		expect(allocations).toHaveLength(2); // rent + water
		expect(await groupCount(agreementId)).toBe(1);
		expect(await utilityPaidFlag(water.id)).toBe(true);
	});

	it("Node serves a same-key retry the winner's group without a second receipt", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		const { leaseId, electric, water } = await leaseWithUtilities(
			ownerId,
			tenantId,
			propertyId,
			"B11-n5",
		);
		const api = clients(ownerId);
		const input = {
			leaseId,
			utilityIds: [electric.id, water.id],
			paymentDate: PAYMENT_DATE,
			paymentMethods: "upi",
			idempotencyKey: crypto.randomUUID(),
		};

		const first = await api.createCombinedBillPayment(input);
		const second = await api.createCombinedBillPayment(input);

		expect(second.paymentGroup.id).toBe(first.paymentGroup.id);
		expect(second.payments).toHaveLength(first.payments.length);
		expect(await groupCount(first.paymentGroup.agreementId)).toBe(1);
		expect(sendAgreementPaymentReceiptEmail).toHaveBeenCalledTimes(1);
	});

	it("Node rejects a reused key naming a different bill set", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		const { leaseId, electric, water } = await leaseWithUtilities(
			ownerId,
			tenantId,
			propertyId,
			"B11-n6",
		);
		const api = clients(ownerId);
		const key = crypto.randomUUID();
		await api.createCombinedBillPayment({
			leaseId,
			utilityIds: [electric.id],
			paymentDate: PAYMENT_DATE,
			paymentMethods: "upi",
			idempotencyKey: key,
		});

		await expect(
			api.createCombinedBillPayment({
				leaseId,
				utilityIds: [water.id],
				paymentDate: PAYMENT_DATE,
				paymentMethods: "upi",
				idempotencyKey: key,
			}),
		).rejects.toMatchObject({ code: "CONFLICT" });
	});

	it("Node records only utility legs when rent is already settled", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		const { leaseId, agreementId, electric, water } = await leaseWithUtilities(
			ownerId,
			tenantId,
			propertyId,
			"B11-n7",
		);
		const api = clients(ownerId);
		await api.createPayment({
			leaseId,
			amount: UNIT_RENT,
			paymentDate: PAYMENT_DATE,
			type: PAYMENT_TYPES.RENT,
			idempotencyKey: crypto.randomUUID(),
		});

		const { payments: allocations } = await api.createCombinedBillPayment({
			leaseId,
			utilityIds: [electric.id, water.id],
			paymentDate: PAYMENT_DATE,
			paymentMethods: "upi",
			idempotencyKey: crypto.randomUUID(),
		});

		expect(allocations).toHaveLength(2);
		expect(allocations.every((p) => p.type === PAYMENT_TYPES.UTILITY)).toBe(
			true,
		);
		expect(await groupCount(agreementId)).toBe(1);
	});

	it("Node combined settlement races an individual utility payment without over-settling", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		const { leaseId, electric, water } = await leaseWithUtilities(
			ownerId,
			tenantId,
			propertyId,
			"B11-n8",
		);
		const api = clients(ownerId);

		const results = await Promise.allSettled([
			api.createCombinedBillPayment({
				leaseId,
				utilityIds: [electric.id, water.id],
				paymentDate: PAYMENT_DATE,
				paymentMethods: "upi",
				idempotencyKey: crypto.randomUUID(),
			}),
			api.recordUtilityPayment({
				utilityId: electric.id,
				leaseId,
				amount: ELECTRIC_AMOUNT,
				paymentMethod: "upi",
				receivedAt: RECEIVED_AT,
				idempotencyKey: crypto.randomUUID(),
			}),
		]);

		expect(
			results.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		expect(
			results.filter((result) => result.status === "rejected"),
		).toHaveLength(1);
		// Exactly one full settlement of the contested bill, whatever the order.
		expect(await utilityLedgerSum(electric.id)).toBe(ELECTRIC_AMOUNT);
		// Water settles only when the combined command won the race.
		const waterSum = await utilityLedgerSum(water.id);
		expect([0, WATER_AMOUNT]).toContain(waterSum);
	});

	it("Neon batch records rent plus utilities in one group", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		const { leaseId, electric, water } = await leaseWithUtilities(
			ownerId,
			tenantId,
			propertyId,
			"B11-x1",
		);
		const api = clients(ownerId, neonPathDatabase());

		const { paymentGroup, payments: allocations } =
			await api.createCombinedBillPayment({
				leaseId,
				utilityIds: [electric.id, water.id],
				paymentDate: PAYMENT_DATE,
				paymentMethods: "upi",
				idempotencyKey: crypto.randomUUID(),
			});

		expect(allocations).toHaveLength(3);
		const utilityLegs = allocations.filter(
			(p) => p.type === PAYMENT_TYPES.UTILITY,
		);
		expect(utilityLegs.map((p) => p.amount).sort((a, b) => a - b)).toEqual([
			WATER_AMOUNT,
			ELECTRIC_AMOUNT,
		]);
		expect(await utilityPaidFlag(electric.id)).toBe(true);
		expect(await utilityPaidFlag(water.id)).toBe(true);
		expect(await groupCount(paymentGroup.agreementId)).toBe(1);
		expect(sendAgreementPaymentReceiptEmail).toHaveBeenCalledTimes(1);
	});

	it("Neon batch writes nothing when a selected utility is already settled", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		const { leaseId, agreementId, electric, water } = await leaseWithUtilities(
			ownerId,
			tenantId,
			propertyId,
			"B11-x2",
		);
		const api = clients(ownerId, neonPathDatabase());
		await clients(ownerId).recordUtilityPayment({
			utilityId: electric.id,
			leaseId,
			amount: ELECTRIC_AMOUNT,
			paymentMethod: "upi",
			receivedAt: RECEIVED_AT,
			idempotencyKey: crypto.randomUUID(),
		});

		await expect(
			api.createCombinedBillPayment({
				leaseId,
				utilityIds: [electric.id, water.id],
				paymentDate: PAYMENT_DATE,
				paymentMethods: "upi",
				idempotencyKey: crypto.randomUUID(),
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		expect(await groupCount(agreementId)).toBe(0);
		expect(await utilityLedgerSum(water.id)).toBe(0);
		expect(await utilityPaidFlag(water.id)).toBe(false);
		expect(sendAgreementPaymentReceiptEmail).not.toHaveBeenCalled();
	});

	it("Neon batch serves a same-key retry the winner's group", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		const { leaseId, electric, water } = await leaseWithUtilities(
			ownerId,
			tenantId,
			propertyId,
			"B11-x3",
		);
		const api = clients(ownerId, neonPathDatabase());
		const input = {
			leaseId,
			utilityIds: [electric.id, water.id],
			paymentDate: PAYMENT_DATE,
			paymentMethods: "upi",
			idempotencyKey: crypto.randomUUID(),
		};

		const first = await api.createCombinedBillPayment(input);
		const second = await api.createCombinedBillPayment(input);

		expect(second.paymentGroup.id).toBe(first.paymentGroup.id);
		expect(second.payments).toHaveLength(first.payments.length);
		expect(await groupCount(first.paymentGroup.agreementId)).toBe(1);
		expect(sendAgreementPaymentReceiptEmail).toHaveBeenCalledTimes(1);
	});

	it("Neon batch combined settlement races an individual utility payment without over-settling", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		const { leaseId, electric, water } = await leaseWithUtilities(
			ownerId,
			tenantId,
			propertyId,
			"B11-x4",
		);
		const api = clients(ownerId, neonPathDatabase());

		const results = await Promise.allSettled([
			api.createCombinedBillPayment({
				leaseId,
				utilityIds: [electric.id, water.id],
				paymentDate: PAYMENT_DATE,
				paymentMethods: "upi",
				idempotencyKey: crypto.randomUUID(),
			}),
			api.recordUtilityPayment({
				utilityId: electric.id,
				leaseId,
				amount: ELECTRIC_AMOUNT,
				paymentMethod: "upi",
				receivedAt: RECEIVED_AT,
				idempotencyKey: crypto.randomUUID(),
			}),
		]);

		expect(
			results.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		expect(
			results.filter((result) => result.status === "rejected"),
		).toHaveLength(1);
		expect(await utilityLedgerSum(electric.id)).toBe(ELECTRIC_AMOUNT);
	});
});
