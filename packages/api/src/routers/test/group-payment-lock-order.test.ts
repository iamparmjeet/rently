import { createRouterClient } from "@orpc/server";
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
	leaseAgreements,
	leases,
	paymentGroups,
	payments,
	properties,
	rentAllocations,
	rentCharges,
	tenantProfiles,
	units,
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

import { createCredit } from "../rent/credit";
import { createCombinedLease } from "../rent/lease";
import { createAgreementPayment, createPayment } from "../rent/payment";

const db = createDb();

const createdUserIds: string[] = [];
const createdProfileIds: string[] = [];
const createdPropertyIds: string[] = [];
const createdUnitIds: string[] = [];
const createdLeaseIds: string[] = [];
const createdAgreementIds: string[] = [];

const UNIT_RENT = 150_000;
const PAYMENT_DATE = new Date("2026-09-05T00:00:00.000Z");

function clients(ownerId: string, database: typeof db = db) {
	mocks.getSession.mockResolvedValue({
		user: { id: ownerId, role: "owner" },
		session: { id: "b10-session" },
	});
	const context = { db: database, headers: new Headers() } as never;
	return createRouterClient(
		{
			createCredit,
			createPayment,
			createAgreementPayment,
			createCombinedLease,
		},
		{ context },
	);
}

async function ownerProperty() {
	const ownerId = crypto.randomUUID();
	createdUserIds.push(ownerId);
	await db.insert(user).values({
		id: ownerId,
		name: "B10 Owner",
		email: `${ownerId}@test.keyhq.invalid`,
		role: "owner",
	});
	const tenantId = crypto.randomUUID();
	createdUserIds.push(tenantId);
	await db.insert(user).values({
		id: tenantId,
		name: "B10 Tenant",
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
		name: "B10 Property",
		address: "1 B10 Road, Mumbai",
		type: PROPERTY_TYPES.RESIDENTIAL,
	});
	mocks.getSession.mockResolvedValue({
		user: { id: ownerId, role: "owner" },
		session: { id: "b10-session" },
	});
	return { ownerId, tenantId, propertyId };
}

async function combinedAgreement(
	ownerId: string,
	tenantId: string,
	propertyId: string,
	unitPrefix: string,
) {
	const createdUnits = await db
		.insert(units)
		.values([
			{
				id: crypto.randomUUID(),
				propertyId,
				unitNumber: `${unitPrefix}-A`,
				type: UNIT_TYPES.ONEBHK,
				baseRent: UNIT_RENT,
				status: UNIT_STATUSES.AVAILABLE,
			},
			{
				id: crypto.randomUUID(),
				propertyId,
				unitNumber: `${unitPrefix}-B`,
				type: UNIT_TYPES.ONEBHK,
				baseRent: UNIT_RENT,
				status: UNIT_STATUSES.AVAILABLE,
			},
		])
		.returning();
	createdUnitIds.push(...createdUnits.map((unit) => unit.id));
	const result = await clients(ownerId).createCombinedLease({
		tenantId,
		startDate: new Date("2026-09-01T00:00:00.000Z"),
		endDate: new Date("2027-09-01T00:00:00.000Z"),
		units: createdUnits.map((unit) => ({
			unitId: unit.id,
			rent: UNIT_RENT,
		})),
	});
	const agreementId = result.leases[0]?.agreementId;
	if (!agreementId)
		throw new Error("Combined lease did not create an agreement");
	createdAgreementIds.push(agreementId);
	const leaseRows = await db
		.select({ id: leases.id })
		.from(leases)
		.where(eq(leases.agreementId, agreementId));
	createdLeaseIds.push(...leaseRows.map((lease) => lease.id));
	leaseRows.sort((a, b) => a.id.localeCompare(b.id));
	return { agreementId, leaseIds: leaseRows.map((lease) => lease.id) };
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

async function rentPaymentsForAgreement() {
	return db
		.select({
			id: payments.id,
			leaseId: payments.leaseId,
			amount: payments.amount,
			type: payments.type,
			paymentGroupId: payments.paymentGroupId,
		})
		.from(payments)
		.innerJoin(leases, eq(payments.leaseId, leases.id))
		.where(inArray(leases.agreementId, createdAgreementIds));
}

// Invariant under test: the signed rent ledger of every lease in the
// agreement never exceeds one period of rent, no matter how the concurrent
// writers interleave.
async function expectNoLeaseOverpaid() {
	const rows = await rentPaymentsForAgreement();
	const signedByLease = new Map<string, number>();
	for (const row of rows) {
		if (row.type !== PAYMENT_TYPES.RENT) continue;
		signedByLease.set(
			row.leaseId,
			(signedByLease.get(row.leaseId) ?? 0) + row.amount,
		);
	}
	for (const leaseId of createdLeaseIds) {
		expect(signedByLease.get(leaseId) ?? 0).toBeLessThanOrEqual(UNIT_RENT);
	}
	return { rows, signedByLease };
}

afterEach(async () => {
	if (createdLeaseIds.length > 0) {
		// C04: the period ledger references leases — clear it first.
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

describe("B10 grouped allocation locking", () => {
	it("Node serializes two distinct-key grouped requests", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		const { agreementId } = await combinedAgreement(
			ownerId,
			tenantId,
			propertyId,
			"B10-n1",
		);
		const api = clients(ownerId);
		const input = (idempotencyKey: string) => ({
			agreementId,
			paymentDate: PAYMENT_DATE,
			paymentMethods: "upi",
			idempotencyKey,
		});

		const results = await Promise.allSettled([
			api.createAgreementPayment(input(crypto.randomUUID())),
			api.createAgreementPayment(input(crypto.randomUUID())),
		]);

		expect(
			results.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		expect(
			results.filter((result) => result.status === "rejected"),
		).toHaveLength(1);
		const { rows } = await expectNoLeaseOverpaid();
		expect(rows).toHaveLength(2);
	});

	it("Node rejects a grouped request racing an individual rent payment", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		const { agreementId, leaseIds } = await combinedAgreement(
			ownerId,
			tenantId,
			propertyId,
			"B10-n2",
		);
		const api = clients(ownerId);
		const results = await Promise.allSettled([
			api.createAgreementPayment({
				agreementId,
				paymentDate: PAYMENT_DATE,
				paymentMethods: "upi",
				idempotencyKey: crypto.randomUUID(),
			}),
			api.createPayment({
				leaseId: leaseIds[0] as string,
				amount: UNIT_RENT,
				paymentDate: PAYMENT_DATE,
				type: PAYMENT_TYPES.RENT,
				idempotencyKey: crypto.randomUUID(),
			}),
		]);

		expect(
			results.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		expect(
			results.filter((result) => result.status === "rejected"),
		).toHaveLength(1);
		await expectNoLeaseOverpaid();
	});

	it("Node serves a same-key grouped retry the winner's group", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		const { agreementId } = await combinedAgreement(
			ownerId,
			tenantId,
			propertyId,
			"B10-n3",
		);
		const api = clients(ownerId);
		const key = crypto.randomUUID();
		const input = {
			agreementId,
			paymentDate: PAYMENT_DATE,
			paymentMethods: "upi",
			idempotencyKey: key,
		};

		const results = await Promise.allSettled([
			api.createAgreementPayment(input),
			api.createAgreementPayment(input),
		]);
		const fulfilled = results.filter(
			(
				result,
			): result is PromiseFulfilledResult<
				Awaited<ReturnType<typeof api.createAgreementPayment>>
			> => result.status === "fulfilled",
		);
		expect(fulfilled).toHaveLength(2);
		expect(fulfilled[1]?.value.paymentGroup.id).toBe(
			fulfilled[0]?.value.paymentGroup.id,
		);
		const { rows } = await expectNoLeaseOverpaid();
		expect(rows).toHaveLength(2);
		const [group] = await db
			.select({ id: paymentGroups.id })
			.from(paymentGroups)
			.where(eq(paymentGroups.agreementId, agreementId));
		expect(group).toBeDefined();
	});

	it("Node recomputes allocations after a partial individual settlement", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		const { agreementId, leaseIds } = await combinedAgreement(
			ownerId,
			tenantId,
			propertyId,
			"B10-n4",
		);
		const api = clients(ownerId);
		// Settle one lease individually first; the grouped command must derive
		// its allocations from the post-payment balances (lease 0 due = 0).
		await api.createPayment({
			leaseId: leaseIds[0] as string,
			amount: UNIT_RENT,
			paymentDate: PAYMENT_DATE,
			type: PAYMENT_TYPES.RENT,
			idempotencyKey: crypto.randomUUID(),
		});
		await expect(
			api.createAgreementPayment({
				agreementId,
				paymentDate: PAYMENT_DATE,
				paymentMethods: "upi",
				idempotencyKey: crypto.randomUUID(),
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		const rows = await rentPaymentsForAgreement();
		expect(rows).toHaveLength(1);
	});

	it("Neon conditional SQL serializes two distinct-key grouped requests", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		const { agreementId } = await combinedAgreement(
			ownerId,
			tenantId,
			propertyId,
			"B10-x1",
		);
		const api = clients(ownerId, neonPathDatabase());
		const input = (idempotencyKey: string) => ({
			agreementId,
			paymentDate: PAYMENT_DATE,
			paymentMethods: "upi",
			idempotencyKey,
		});

		const results = await Promise.allSettled([
			api.createAgreementPayment(input(crypto.randomUUID())),
			api.createAgreementPayment(input(crypto.randomUUID())),
		]);

		expect(
			results.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		expect(
			results.filter((result) => result.status === "rejected"),
		).toHaveLength(1);
		const { rows } = await expectNoLeaseOverpaid();
		expect(rows).toHaveLength(2);
	});

	it("Neon conditional SQL rejects a grouped request racing an individual rent payment", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		const { agreementId, leaseIds } = await combinedAgreement(
			ownerId,
			tenantId,
			propertyId,
			"B10-x2",
		);
		const api = clients(ownerId, neonPathDatabase());
		const results = await Promise.allSettled([
			api.createAgreementPayment({
				agreementId,
				paymentDate: PAYMENT_DATE,
				paymentMethods: "upi",
				idempotencyKey: crypto.randomUUID(),
			}),
			api.createPayment({
				leaseId: leaseIds[0] as string,
				amount: UNIT_RENT,
				paymentDate: PAYMENT_DATE,
				type: PAYMENT_TYPES.RENT,
				idempotencyKey: crypto.randomUUID(),
			}),
		]);

		expect(
			results.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		expect(
			results.filter((result) => result.status === "rejected"),
		).toHaveLength(1);
		await expectNoLeaseOverpaid();
	});

	it("Neon conditional SQL serves a same-key grouped retry the winner's group", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		const { agreementId } = await combinedAgreement(
			ownerId,
			tenantId,
			propertyId,
			"B10-x3",
		);
		const api = clients(ownerId, neonPathDatabase());
		const key = crypto.randomUUID();
		const input = {
			agreementId,
			paymentDate: PAYMENT_DATE,
			paymentMethods: "upi",
			idempotencyKey: key,
		};

		const results = await Promise.allSettled([
			api.createAgreementPayment(input),
			api.createAgreementPayment(input),
		]);
		const fulfilled = results.filter(
			(
				result,
			): result is PromiseFulfilledResult<
				Awaited<ReturnType<typeof api.createAgreementPayment>>
			> => result.status === "fulfilled",
		);
		expect(fulfilled).toHaveLength(2);
		expect(fulfilled[1]?.value.paymentGroup.id).toBe(
			fulfilled[0]?.value.paymentGroup.id,
		);
		const { rows } = await expectNoLeaseOverpaid();
		expect(rows).toHaveLength(2);
	});

	it("Neon conditional SQL respects a rent credit in its balance recheck", async () => {
		const { ownerId, tenantId, propertyId } = await ownerProperty();
		const { agreementId, leaseIds } = await combinedAgreement(
			ownerId,
			tenantId,
			propertyId,
			"B10-x4",
		);
		const api = clients(ownerId, neonPathDatabase());
		await api.createCredit({
			leaseId: leaseIds[0] as string,
			type: CREDIT_TYPES.DISCOUNT,
			amount: -UNIT_RENT,
			reason: "B10 full rent discount",
			idempotencyKey: crypto.randomUUID(),
		});
		await expect(
			api.createAgreementPayment({
				agreementId,
				paymentDate: PAYMENT_DATE,
				paymentMethods: "upi",
				idempotencyKey: crypto.randomUUID(),
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		const rows = await rentPaymentsForAgreement();
		expect(rows).toHaveLength(0);
	});
});
