import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import { CREDIT_TYPES } from "@rently/db/constants/payment-constants";
import {
	LEASE_STATUSES,
	PAYMENT_TYPES,
	PROPERTY_TYPES,
	UNIT_STATUSES,
	UNIT_TYPES,
	UTILITY_TYPES,
} from "@rently/db/constants/rent-constants";
import { user } from "@rently/db/schema/auth";
import {
	billCredits,
	leases,
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

import { createCredit } from "../rent/credit";
import { createPayment, voidPayment } from "../rent/payment";
import { recordUtilityPayment } from "../rent/utility";

const db = createDb();

const created = {
	leaseIds: [] as string[],
	unitIds: [] as string[],
	propertyIds: [] as string[],
	profileIds: [] as string[],
	userIds: [] as string[],
};

async function leaseFixture(rent = 10_000) {
	const ownerId = crypto.randomUUID();
	const tenantId = crypto.randomUUID();
	const propertyId = crypto.randomUUID();
	const unitId = crypto.randomUUID();
	const leaseId = crypto.randomUUID();
	const profileId = crypto.randomUUID();
	created.userIds.push(ownerId, tenantId);
	created.propertyIds.push(propertyId);
	created.unitIds.push(unitId);
	created.leaseIds.push(leaseId);
	created.profileIds.push(profileId);

	await db.insert(user).values([
		{
			id: ownerId,
			name: "B08 Owner",
			email: `${ownerId}@test.keyhq.invalid`,
			role: "owner",
		},
		{
			id: tenantId,
			name: "B08 Tenant",
			email: `${tenantId}@test.keyhq.invalid`,
			role: "tenant",
		},
	]);
	await db.insert(tenantProfiles).values({
		id: profileId,
		userId: tenantId,
		createdById: ownerId,
	});
	await db.insert(properties).values({
		id: propertyId,
		ownerId,
		name: "B08 Property",
		address: "B08 Test Road",
		type: PROPERTY_TYPES.RESIDENTIAL,
	});
	await db.insert(units).values({
		id: unitId,
		propertyId,
		unitNumber: `B08-${unitId.slice(0, 6)}`,
		type: UNIT_TYPES.ONEBHK,
		baseRent: rent,
		status: UNIT_STATUSES.OCCUPIED,
	});
	await db.insert(leases).values({
		id: leaseId,
		unitId,
		tenantId,
		startDate: new Date("2026-01-01T00:00:00.000Z"),
		endDate: new Date("2027-01-01T00:00:00.000Z"),
		rent,
		status: LEASE_STATUSES.ACTIVE,
	});

	mocks.getSession.mockResolvedValue({
		user: { id: ownerId, role: "owner" },
		session: { id: "b08-session" },
	});
	return { ownerId, leaseId };
}

async function utilityFixture(leaseId: string, totalAmount = 5_000) {
	const utilityId = crypto.randomUUID();
	await db.insert(utilities).values({
		id: utilityId,
		leaseId,
		utilityType: UTILITY_TYPES.ELECTRICITY,
		previousReadingDate: new Date("2026-08-01T00:00:00.000Z"),
		currentReadingDate: new Date("2026-08-31T00:00:00.000Z"),
		previousReading: 10,
		currentReading: 20,
		ratePerUnit: 100,
		fixedCharge: 0,
		totalAmount,
	});
	return utilityId;
}

function client(_ownerId: string, database: typeof db = db) {
	return createRouterClient(
		{ createCredit, createPayment, recordUtilityPayment, voidPayment },
		{ context: { db: database, headers: new Headers() } as never },
	);
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

async function paymentCount(leaseId: string) {
	return db
		.select({ id: payments.id })
		.from(payments)
		.where(eq(payments.leaseId, leaseId));
}

afterEach(async () => {
	if (created.leaseIds.length > 0) {
		await db
			.delete(billCredits)
			.where(inArray(billCredits.leaseId, created.leaseIds));
		await db
			.delete(payments)
			.where(inArray(payments.leaseId, created.leaseIds));
		await db
			.delete(utilities)
			.where(inArray(utilities.leaseId, created.leaseIds));
		await db.delete(leases).where(inArray(leases.id, created.leaseIds));
		await db.delete(units).where(inArray(units.id, created.unitIds));
	}
	if (created.propertyIds.length > 0) {
		await db
			.delete(properties)
			.where(inArray(properties.id, created.propertyIds));
	}
	if (created.profileIds.length > 0) {
		await db
			.delete(tenantProfiles)
			.where(inArray(tenantProfiles.id, created.profileIds));
	}
	if (created.userIds.length > 0) {
		await db.delete(user).where(inArray(user.id, created.userIds));
	}
	created.leaseIds.length = 0;
	created.unitIds.length = 0;
	created.propertyIds.length = 0;
	created.profileIds.length = 0;
	created.userIds.length = 0;
	mocks.getSession.mockReset();
});

describe("B08 atomic individual settlement", () => {
	it("Node serializes distinct-key rent payments", async () => {
		const { ownerId, leaseId } = await leaseFixture();
		const api = client(ownerId);
		const input = (idempotencyKey: string) => ({
			leaseId,
			amount: 10_000,
			paymentDate: new Date("2026-09-05T00:00:00.000Z"),
			type: PAYMENT_TYPES.RENT,
			idempotencyKey,
		});

		const results = await Promise.allSettled([
			api.createPayment(input(crypto.randomUUID())),
			api.createPayment(input(crypto.randomUUID())),
		]);

		expect(
			results.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		expect(
			results.filter((result) => result.status === "rejected"),
		).toHaveLength(1);
		await expect(paymentCount(leaseId)).resolves.toHaveLength(1);
	});

	it("Neon conditional SQL serializes distinct-key rent payments", async () => {
		const { ownerId, leaseId } = await leaseFixture();
		const api = client(ownerId, neonPathDatabase());
		const input = (idempotencyKey: string) => ({
			leaseId,
			amount: 10_000,
			paymentDate: new Date("2026-09-05T00:00:00.000Z"),
			type: PAYMENT_TYPES.RENT,
			idempotencyKey,
		});

		const results = await Promise.allSettled([
			api.createPayment(input(crypto.randomUUID())),
			api.createPayment(input(crypto.randomUUID())),
		]);

		expect(
			results.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		expect(
			results.filter((result) => result.status === "rejected"),
		).toHaveLength(1);
		await expect(paymentCount(leaseId)).resolves.toHaveLength(1);
	});

	it("serializes a rent payment against a rent credit", async () => {
		const { ownerId, leaseId } = await leaseFixture();
		const api = client(ownerId);
		const results = await Promise.allSettled([
			api.createPayment({
				leaseId,
				amount: 10_000,
				paymentDate: new Date("2026-09-05T00:00:00.000Z"),
				type: PAYMENT_TYPES.RENT,
				idempotencyKey: crypto.randomUUID(),
			}),
			api.createCredit({
				leaseId,
				type: CREDIT_TYPES.DISCOUNT,
				amount: -10_000,
				reason: "B08 concurrent rent credit",
				idempotencyKey: crypto.randomUUID(),
			}),
		]);

		expect(
			results.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		const [credits] = await Promise.all([
			db.select().from(billCredits).where(eq(billCredits.leaseId, leaseId)),
		]);
		const paymentsForLease = await paymentCount(leaseId);
		expect(credits.length + paymentsForLease.length).toBe(1);
	});

	it("serializes a partial rent payment against its reversal", async () => {
		const { ownerId, leaseId } = await leaseFixture();
		const originalId = crypto.randomUUID();
		await db.insert(payments).values({
			id: originalId,
			leaseId,
			amount: 5_000,
			paymentDate: new Date("2026-09-01T00:00:00.000Z"),
			type: PAYMENT_TYPES.RENT,
			idempotencyKey: crypto.randomUUID(),
		});
		const api = client(ownerId);

		const results = await Promise.allSettled([
			api.createPayment({
				leaseId,
				amount: 5_000,
				paymentDate: new Date("2026-09-05T00:00:00.000Z"),
				type: PAYMENT_TYPES.RENT,
				idempotencyKey: crypto.randomUUID(),
			}),
			api.voidPayment({ id: originalId }),
		]);

		expect(
			results.filter((result) => result.status === "rejected").length,
		).toBeLessThanOrEqual(1);
		const [rows] = await Promise.all([
			db.select().from(payments).where(eq(payments.leaseId, leaseId)),
		]);
		const signedTotal = rows
			.filter(
				(row) =>
					row.type === PAYMENT_TYPES.RENT ||
					row.type === PAYMENT_TYPES.REVERSAL,
			)
			.reduce((sum, row) => sum + row.amount, 0);
		expect(signedTotal).toBeLessThanOrEqual(10_000);
	});

	it("rejects payment, credit, and utility amounts above the remaining due", async () => {
		const { ownerId, leaseId } = await leaseFixture();
		const utilityId = await utilityFixture(leaseId);
		const api = client(ownerId);

		await expect(
			api.createPayment({
				leaseId,
				amount: 10_001,
				type: PAYMENT_TYPES.RENT,
				paymentDate: new Date("2026-09-05T00:00:00.000Z"),
				idempotencyKey: crypto.randomUUID(),
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			api.createCredit({
				leaseId,
				type: CREDIT_TYPES.DISCOUNT,
				amount: -10_001,
				reason: "B08 excessive rent credit",
				idempotencyKey: crypto.randomUUID(),
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			api.recordUtilityPayment({
				leaseId,
				utilityId,
				amount: 5_001,
				paymentMethod: "cash",
				receivedAt: "2026-09-05",
				idempotencyKey: crypto.randomUUID(),
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("Neon conditionally settles a utility payment and credit", async () => {
		const { ownerId, leaseId } = await leaseFixture();
		const utilityId = await utilityFixture(leaseId);
		const api = client(ownerId, neonPathDatabase());
		const utilityResults = await Promise.allSettled([
			api.recordUtilityPayment({
				leaseId,
				utilityId,
				amount: 5_000,
				paymentMethod: "cash",
				receivedAt: "2026-09-05",
				idempotencyKey: crypto.randomUUID(),
			}),
			api.recordUtilityPayment({
				leaseId,
				utilityId,
				amount: 5_000,
				paymentMethod: "cash",
				receivedAt: "2026-09-05",
				idempotencyKey: crypto.randomUUID(),
			}),
		]);
		expect(
			utilityResults.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);

		const secondUtilityId = await utilityFixture(leaseId, 2_000);
		const creditResults = await Promise.allSettled([
			api.createCredit({
				leaseId,
				utilityId: secondUtilityId,
				type: CREDIT_TYPES.DISCOUNT,
				amount: -2_000,
				reason: "B08 concurrent utility credit",
				idempotencyKey: crypto.randomUUID(),
			}),
			api.createCredit({
				leaseId,
				utilityId: secondUtilityId,
				type: CREDIT_TYPES.DISCOUNT,
				amount: -2_000,
				reason: "B08 concurrent utility credit",
				idempotencyKey: crypto.randomUUID(),
			}),
		]);
		expect(
			creditResults.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
	});
});
