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
	paymentGroups,
	payments,
	properties,
	tenantProfiles,
	units,
} from "@rently/db/schema/schema";
import { generatedId } from "@rently/db/utils/id";
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

import { createCombinedLease } from "../rent/lease";
import { createAgreementPayment, voidPaymentGroup } from "../rent/payment";

const db = createDb();

const createdUserIds: string[] = [];
const createdProfileIds: string[] = [];
const createdPropertyIds: string[] = [];
const createdUnitIds: string[] = [];
const createdGroupIds: string[] = [];

async function createCombinedFixture() {
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
	const madeUnits = await db
		.insert(units)
		.values([
			{
				propertyId,
				unitNumber: "B05-A",
				type: UNIT_TYPES.ONEBHK,
				baseRent: 1100,
				status: UNIT_STATUSES.AVAILABLE,
			},
			{
				propertyId,
				unitNumber: "B05-B",
				type: UNIT_TYPES.ONEBHK,
				baseRent: 1900,
				status: UNIT_STATUSES.AVAILABLE,
			},
		])
		.returning();
	createdUnitIds.push(...madeUnits.map((unit) => unit.id));
	mocks.getSession.mockResolvedValue({
		user: { id: ownerId, role: "owner" },
		session: { id: "test-session" },
	});
	const context = { db, headers: new Headers() } as never;
	const leasesApi = createRouterClient({ createCombinedLease }, { context });
	const { leases: combined } = await leasesApi.createCombinedLease({
		tenantId,
		startDate: new Date("2026-09-01T00:00:00.000Z"),
		endDate: new Date("2027-09-01T00:00:00.000Z"),
		units: madeUnits.map((unit) => ({
			unitId: unit.id,
			rent: unit.baseRent,
		})),
	});
	const client = createRouterClient(
		{ createAgreementPayment, voidPaymentGroup },
		{ context },
	);
	const grouped = await client.createAgreementPayment({
		agreementId: combined[0]?.agreementId as string,
		paymentDate: new Date("2026-09-05T00:00:00.000Z"),
		paymentMethods: "upi",
	});
	createdGroupIds.push(grouped.paymentGroup.id);
	return {
		client,
		groupId: grouped.paymentGroup.id,
		allocationCount: grouped.payments.length,
	};
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
		if (createdGroupIds.length > 0) {
			await db
				.delete(paymentGroups)
				.where(inArray(paymentGroups.id, createdGroupIds));
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
	createdGroupIds.length = 0;
	mocks.getSession.mockReset();
});

describe("atomic group void (B05)", () => {
	it("lets exactly one of two simultaneous group voids create the reversal", async () => {
		const { client, groupId, allocationCount } = await createCombinedFixture();
		const [first, second] = await Promise.all([
			client.voidPaymentGroup({ id: groupId }),
			client.voidPaymentGroup({ id: groupId }),
		]);
		expect(first.paymentGroup.id).toBe(second.paymentGroup.id);
		expect(first.paymentGroup.reversesPaymentGroupId).toBe(groupId);
		createdGroupIds.push(first.paymentGroup.id);
		expect(first.reversals).toHaveLength(allocationCount);
		for (const row of first.reversals) {
			expect(row.reversesPaymentId).not.toBeNull();
		}
		const groups = await db
			.select({ id: paymentGroups.id })
			.from(paymentGroups)
			.where(eq(paymentGroups.reversesPaymentGroupId, groupId));
		expect(groups).toHaveLength(1);
	});

	it("returns the complete reversal group on repeated requests", async () => {
		const { client, groupId, allocationCount } = await createCombinedFixture();
		const { paymentGroup } = await client.voidPaymentGroup({ id: groupId });
		createdGroupIds.push(paymentGroup.id);
		const retry = await client.voidPaymentGroup({ id: groupId });
		expect(retry.paymentGroup.id).toBe(paymentGroup.id);
		expect(retry.reversals).toHaveLength(allocationCount);
		const groups = await db
			.select({ id: paymentGroups.id })
			.from(paymentGroups)
			.where(eq(paymentGroups.reversesPaymentGroupId, groupId));
		expect(groups).toHaveLength(1);
	});

	it("refuses to serve a partially reversed group instead of completing it silently", async () => {
		const { client, groupId } = await createCombinedFixture();
		// Simulate a crashed batch: reversal group row with a missing allocation.
		const partialGroupId = generatedId();
		createdGroupIds.push(partialGroupId);
		const originals = await db
			.select({ id: payments.id })
			.from(payments)
			.where(eq(payments.paymentGroupId, groupId));
		expect(originals.length).toBeGreaterThan(1);
		const agreementId = (
			await db
				.select({ agreementId: paymentGroups.agreementId })
				.from(paymentGroups)
				.where(eq(paymentGroups.id, groupId))
		)[0]?.agreementId as string;
		await db.insert(paymentGroups).values({
			id: partialGroupId,
			agreementId,
			paymentDate: new Date(),
			reversesPaymentGroupId: groupId,
		});
		const first = originals[0];
		if (!first) throw new Error("Fixture needs an allocation");
		await db.insert(payments).values({
			leaseId: (
				await db
					.select({ leaseId: payments.leaseId })
					.from(payments)
					.where(eq(payments.id, first.id))
			)[0]?.leaseId as string,
			amount: -1100,
			paymentDate: new Date(),
			type: PAYMENT_TYPES.REVERSAL,
			referenceNumber: first.id,
			reversesPaymentId: first.id,
			paymentGroupId: partialGroupId,
		});
		await expect(
			client.voidPaymentGroup({ id: groupId }),
		).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
		const groups = await db
			.select({ id: paymentGroups.id })
			.from(paymentGroups)
			.where(eq(paymentGroups.reversesPaymentGroupId, groupId));
		expect(groups).toHaveLength(1);
		expect(groups[0]?.id).toBe(partialGroupId);
	});
});

describe("group reversal uniqueness (B05) — database", () => {
	it("rejects a second reversal group for the same original", async () => {
		const { client, groupId } = await createCombinedFixture();
		const { paymentGroup } = await client.voidPaymentGroup({ id: groupId });
		createdGroupIds.push(paymentGroup.id);
		const [original] = await db
			.select({ agreementId: paymentGroups.agreementId })
			.from(paymentGroups)
			.where(eq(paymentGroups.id, groupId));
		if (!original) throw new Error("Fixture needs a group");
		await expect(
			db.insert(paymentGroups).values({
				agreementId: original.agreementId,
				paymentDate: new Date(),
				reversesPaymentGroupId: groupId,
			}),
		).rejects.toMatchObject({ cause: { code: "23505" } });
	});
});
