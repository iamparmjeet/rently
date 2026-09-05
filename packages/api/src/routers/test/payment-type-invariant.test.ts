import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import {
	LEASE_STATUSES,
	PAYMENT_TYPES,
	type PaymentType,
	PROPERTY_TYPES,
	UNIT_STATUSES,
	UNIT_TYPES,
	UTILITY_TYPES,
} from "@rently/db/constants/rent-constants";
import { user } from "@rently/db/schema/auth";
import {
	leases,
	payments,
	properties,
	units,
	utilities,
} from "@rently/db/schema/schema";
import { generatedId } from "@rently/db/utils/id";
import { inArray } from "drizzle-orm";
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
}));

import { createPayment } from "../rent/payment";

const db = createDb();

const createdUserIds: string[] = [];
const createdPropertyIds: string[] = [];
const createdUnitIds: string[] = [];
const createdLeaseIds: string[] = [];
const createdUtilityIds: string[] = [];
const createdPaymentIds: string[] = [];

async function createOwnerLeaseFixture() {
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
		unitNumber: "B01",
		type: UNIT_TYPES.ONEBHK,
		baseRent: 10_000_00,
		status: UNIT_STATUSES.OCCUPIED,
	});

	const leaseId = crypto.randomUUID();
	createdLeaseIds.push(leaseId);
	await db.insert(leases).values({
		id: leaseId,
		unitId,
		tenantId,
		startDate: new Date("2026-01-01T00:00:00.000Z"),
		rent: 10_000_00,
		status: LEASE_STATUSES.ACTIVE,
	});

	const utilityId = crypto.randomUUID();
	createdUtilityIds.push(utilityId);
	await db.insert(utilities).values({
		id: utilityId,
		leaseId,
		utilityType: UTILITY_TYPES.ELECTRICITY,
		currentReadingDate: new Date("2026-08-31T00:00:00.000Z"),
		previousReading: 100,
		currentReading: 150,
		totalAmount: 5_00_00,
	});

	mocks.getSession.mockResolvedValue({
		user: { id: ownerId, role: "owner" },
		session: { id: "test-session" },
	});
	const client = createRouterClient(
		{ createPayment },
		{ context: { db, headers: new Headers() } },
	);
	return { leaseId, utilityId, client };
}

afterEach(async () => {
	// Any payment created for a fixture lease (tracked or not) goes first.
	if (createdLeaseIds.length > 0) {
		await db.delete(payments).where(inArray(payments.leaseId, createdLeaseIds));
	}
	if (createdUtilityIds.length > 0) {
		await db.delete(utilities).where(inArray(utilities.id, createdUtilityIds));
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
	createdUtilityIds.length = 0;
	createdPaymentIds.length = 0;
	mocks.getSession.mockReset();
});

describe("payment type/utility invariant (B01) — API", () => {
	it("rejects a utility payment without a utility", async () => {
		const { leaseId, client } = await createOwnerLeaseFixture();
		await expect(
			client.createPayment({
				leaseId,
				amount: 5_00_00,
				paymentDate: new Date("2026-09-01T00:00:00.000Z"),
				type: PAYMENT_TYPES.UTILITY,
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("rejects a rent payment carrying a utility", async () => {
		const { leaseId, utilityId, client } = await createOwnerLeaseFixture();
		await expect(
			client.createPayment({
				leaseId,
				amount: 10_000_00,
				paymentDate: new Date("2026-09-01T00:00:00.000Z"),
				type: PAYMENT_TYPES.RENT,
				utilityId,
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("rejects a reversal through generic creation", async () => {
		const { leaseId, client } = await createOwnerLeaseFixture();
		await expect(
			client.createPayment({
				leaseId,
				amount: 10_000_00,
				paymentDate: new Date("2026-09-01T00:00:00.000Z"),
				type: PAYMENT_TYPES.REVERSAL,
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("accepts a rent payment without a utility", async () => {
		const { leaseId, client } = await createOwnerLeaseFixture();
		const result = await client.createPayment({
			leaseId,
			amount: 10_000_00,
			paymentDate: new Date("2026-09-01T00:00:00.000Z"),
			type: PAYMENT_TYPES.RENT,
		});
		createdPaymentIds.push(result.payment.id);
		expect(result.payment.type).toBe(PAYMENT_TYPES.RENT);
	});

	it("accepts a deposit payment without a utility", async () => {
		const { leaseId, client } = await createOwnerLeaseFixture();
		const result = await client.createPayment({
			leaseId,
			amount: 1_00_00,
			paymentDate: new Date("2026-09-01T00:00:00.000Z"),
			type: PAYMENT_TYPES.DEPOSIT,
		});
		createdPaymentIds.push(result.payment.id);
		expect(result.payment.type).toBe(PAYMENT_TYPES.DEPOSIT);
	});
});

describe("payment type/utility invariant (B01) — database", () => {
	const cells: Array<{
		type: PaymentType;
		withUtility: boolean;
		allowed: boolean;
	}> = [
		{ type: PAYMENT_TYPES.RENT, withUtility: false, allowed: true },
		{ type: PAYMENT_TYPES.RENT, withUtility: true, allowed: false },
		{ type: PAYMENT_TYPES.UTILITY, withUtility: false, allowed: false },
		{ type: PAYMENT_TYPES.UTILITY, withUtility: true, allowed: true },
		{ type: PAYMENT_TYPES.DEPOSIT, withUtility: false, allowed: true },
		{ type: PAYMENT_TYPES.DEPOSIT, withUtility: true, allowed: false },
		{ type: PAYMENT_TYPES.OTHER, withUtility: false, allowed: true },
		{ type: PAYMENT_TYPES.OTHER, withUtility: true, allowed: false },
		// Reversals preserve the original's utility link until B03 — exempt.
		{ type: PAYMENT_TYPES.REVERSAL, withUtility: false, allowed: true },
		{ type: PAYMENT_TYPES.REVERSAL, withUtility: true, allowed: true },
	];

	for (const { type, withUtility, allowed } of cells) {
		it(`${allowed ? "accepts" : "rejects"} ${type} ${withUtility ? "with" : "without"} utility`, async () => {
			const { leaseId, utilityId } = await createOwnerLeaseFixture();
			const id = generatedId();
			const insert = db.insert(payments).values({
				id,
				leaseId,
				amount: type === PAYMENT_TYPES.REVERSAL ? -1_00_00 : 1_00_00,
				paymentDate: new Date("2026-09-01T00:00:00.000Z"),
				type,
				utilityId: withUtility ? utilityId : null,
			});
			if (allowed) {
				await insert;
				createdPaymentIds.push(id);
			} else {
				// Drizzle wraps driver errors; the Postgres code nests under cause.
				await expect(insert).rejects.toMatchObject({
					cause: { code: "23514" },
				});
			}
		});
	}
});
