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
	leaseAgreements,
	leases,
	payments,
	properties,
	tenantProfiles,
	units,
} from "@rently/db/schema/schema";
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
	sendUtilityBillEmail: vi.fn(),
}));

import { createLease } from "../rent/lease";
import { createPayment, voidPayment } from "../rent/payment";

const db = createDb();

const createdUserIds: string[] = [];
const createdProfileIds: string[] = [];
const createdPropertyIds: string[] = [];
const createdUnitIds: string[] = [];

async function createPaidLease(rent = 10_000_00) {
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
		unitNumber: `B04-${unitId.slice(0, 4)}`,
		type: UNIT_TYPES.ONEBHK,
		baseRent: rent,
		status: UNIT_STATUSES.AVAILABLE,
	});
	mocks.getSession.mockResolvedValue({
		user: { id: ownerId, role: "owner" },
		session: { id: "test-session" },
	});
	const context = { db, headers: new Headers() } as never;
	const leasesApi = createRouterClient({ createLease }, { context });
	const { lease } = await leasesApi.createLease({
		unitId,
		tenantId,
		startDate: new Date("2026-01-01T00:00:00.000Z"),
		endDate: new Date("2027-01-01T00:00:00.000Z"),
		rent,
	});
	const client = createRouterClient(
		{ createPayment, voidPayment },
		{ context },
	);
	const paid = await client.createPayment({
		leaseId: lease.id,
		amount: rent,
		paymentDate: new Date("2026-09-01T00:00:00.000Z"),
		type: PAYMENT_TYPES.RENT,
	});
	return { client, paymentId: paid.payment.id, leaseId: lease.id };
}

async function reversalCount(paymentId: string) {
	return db
		.select({ id: payments.id })
		.from(payments)
		.where(inArray(payments.reversesPaymentId, [paymentId]));
}

afterEach(async () => {
	if (createdUnitIds.length > 0) {
		const leaseRows = await db
			.select({ id: leases.id, agreementId: leases.agreementId })
			.from(leases)
			.where(inArray(leases.unitId, createdUnitIds));
		const leaseIds = leaseRows.map((row) => row.id);
		if (leaseIds.length > 0) {
			await db.delete(payments).where(inArray(payments.leaseId, leaseIds));
			await db.delete(leases).where(inArray(leases.id, leaseIds));
		}
		const agreementIds = [
			...new Set(
				leaseRows
					.map((row) => row.agreementId)
					.filter((id): id is string => id != null),
			),
		];
		if (agreementIds.length > 0) {
			await db
				.delete(leaseAgreements)
				.where(inArray(leaseAgreements.id, agreementIds));
		}
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
	mocks.getSession.mockReset();
});

describe("atomic single-payment void (B04)", () => {
	it("lets exactly one of two simultaneous voids create the reversal", async () => {
		const { client, paymentId } = await createPaidLease();
		const [first, second] = await Promise.all([
			client.voidPayment({ id: paymentId }),
			client.voidPayment({ id: paymentId }),
		]);
		expect(first.reversal.id).toBe(second.reversal.id);
		expect(first.reversal.reversesPaymentId).toBe(paymentId);
		await expect(reversalCount(paymentId)).resolves.toHaveLength(1);
	});

	it("returns the existing reversal on retry after timeout", async () => {
		const { client, paymentId } = await createPaidLease();
		const { reversal } = await client.voidPayment({ id: paymentId });
		// A client retry after a timeout takes the same path again.
		const retry = await client.voidPayment({ id: paymentId });
		expect(retry.reversal.id).toBe(reversal.id);
		await expect(reversalCount(paymentId)).resolves.toHaveLength(1);
	});

	it("returns the existing reversal instead of erroring on an already-voided payment", async () => {
		const { client, paymentId } = await createPaidLease();
		const { reversal } = await client.voidPayment({ id: paymentId });
		const again = await client.voidPayment({ id: paymentId });
		expect(again.reversal.id).toBe(reversal.id);
		expect(again.reversal.reversesPaymentId).toBe(paymentId);
	});

	it("still refuses to void a reversal payment itself", async () => {
		const { client, paymentId } = await createPaidLease();
		const { reversal } = await client.voidPayment({ id: paymentId });
		await expect(client.voidPayment({ id: reversal.id })).rejects.toMatchObject(
			{ code: "BAD_REQUEST" },
		);
	});
});

describe("one-reversal-per-original invariant (B04) — database", () => {
	it("rejects a second reversal row for the same original", async () => {
		const { client, paymentId, leaseId } = await createPaidLease();
		await client.voidPayment({ id: paymentId });
		await expect(
			db.insert(payments).values({
				id: crypto.randomUUID(),
				leaseId,
				amount: -10_000_00,
				paymentDate: new Date("2026-09-02T00:00:00.000Z"),
				type: PAYMENT_TYPES.REVERSAL,
				referenceNumber: paymentId,
				reversesPaymentId: paymentId,
			}),
		).rejects.toMatchObject({ cause: { code: "23505" } });
	});
});
