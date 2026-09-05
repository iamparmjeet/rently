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
	leaseAgreements,
	leases,
	paymentGroups,
	payments,
	properties,
	tenantProfiles,
	units,
	utilities,
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

import { createCredit } from "../rent/credit";
import { createCombinedLease } from "../rent/lease";
import { createAgreementPayment, createPayment } from "../rent/payment";
import {
	createUtility,
	createUtilityBatch,
	recordUtilityPayment,
} from "../rent/utility";

const db = createDb();

const createdUserIds: string[] = [];
const createdProfileIds: string[] = [];
const createdPropertyIds: string[] = [];
const createdUnitIds: string[] = [];
const createdGroupIds: string[] = [];

async function ownerPropertyUnit() {
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
	mocks.getSession.mockResolvedValue({
		user: { id: ownerId, role: "owner" },
		session: { id: "test-session" },
	});
	return { ownerId, tenantId, propertyId };
}

async function directLease(
	propertyId: string,
	tenantId: string,
	unitNumber: string,
	rent = 10_000_00,
) {
	const unitId = crypto.randomUUID();
	createdUnitIds.push(unitId);
	await db.insert(units).values({
		id: unitId,
		propertyId,
		unitNumber,
		type: UNIT_TYPES.ONEBHK,
		baseRent: rent,
		status: UNIT_STATUSES.OCCUPIED,
	});
	const leaseId = crypto.randomUUID();
	await db.insert(leases).values({
		id: leaseId,
		unitId,
		tenantId,
		startDate: new Date("2026-01-01T00:00:00.000Z"),
		endDate: new Date("2027-01-01T00:00:00.000Z"),
		rent,
		status: LEASE_STATUSES.ACTIVE,
	});
	return { unitId, leaseId };
}

async function directBill(leaseId: string, totalAmount = 5_00_00) {
	const utilityId = crypto.randomUUID();
	await db.insert(utilities).values({
		id: utilityId,
		leaseId,
		utilityType: UTILITY_TYPES.ELECTRICITY,
		previousReadingDate: new Date("2026-08-01T00:00:00.000Z"),
		currentReadingDate: new Date("2026-08-31T00:00:00.000Z"),
		previousReading: 100,
		currentReading: 150,
		ratePerUnit: 9,
		fixedCharge: 100_00,
		totalAmount,
	});
	return utilityId;
}

async function additionalTenant(ownerId: string, name: string) {
	const tenantId = crypto.randomUUID();
	createdUserIds.push(tenantId);
	await db.insert(user).values({
		id: tenantId,
		name,
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
	return tenantId;
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
				baseRent: 1100,
				status: UNIT_STATUSES.AVAILABLE,
			},
			{
				id: crypto.randomUUID(),
				propertyId,
				unitNumber: `${unitPrefix}-B`,
				type: UNIT_TYPES.ONEBHK,
				baseRent: 1900,
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
			rent: unit.baseRent,
		})),
	});
	const agreementId = result.leases[0]?.agreementId;
	if (!agreementId)
		throw new Error("Combined lease did not create an agreement");
	return { agreementId, leases: result.leases };
}

function clients(ownerId: string) {
	mocks.getSession.mockResolvedValue({
		user: { id: ownerId, role: "owner" },
		session: { id: "test-session" },
	});
	const context = { db, headers: new Headers() } as never;
	return createRouterClient(
		{
			createPayment,
			recordUtilityPayment,
			createAgreementPayment,
			createCredit,
			createUtility,
			createUtilityBatch,
			createCombinedLease,
		},
		{ context },
	);
}

async function paymentRows(leaseId: string) {
	return db
		.select({ id: payments.id })
		.from(payments)
		.where(eq(payments.leaseId, leaseId));
}

afterEach(async () => {
	if (createdUnitIds.length > 0) {
		const leaseRows = await db
			.select({ id: leases.id, agreementId: leases.agreementId })
			.from(leases)
			.where(inArray(leases.unitId, createdUnitIds));
		const leaseIds = leaseRows.map((row) => row.id);
		if (leaseIds.length > 0) {
			await db
				.delete(billCredits)
				.where(inArray(billCredits.leaseId, leaseIds));
			await db.delete(payments).where(inArray(payments.leaseId, leaseIds));
			await db.delete(utilities).where(inArray(utilities.leaseId, leaseIds));
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

describe("settlement idempotency keys (B07)", () => {
	it("dedupes a retried rent payment on the same key", async () => {
		const { ownerId, tenantId, propertyId } = await ownerPropertyUnit();
		const { leaseId } = await directLease(propertyId, tenantId, "B07-1");
		const client = clients(ownerId);
		const key = crypto.randomUUID();
		const input = {
			leaseId,
			amount: 10_000_00,
			paymentDate: new Date("2026-09-01T00:00:00.000Z"),
			type: PAYMENT_TYPES.RENT,
			idempotencyKey: key,
		} as const;
		const first = await client.createPayment(input);
		const second = await client.createPayment(input);
		expect(second.payment.id).toBe(first.payment.id);
		await expect(paymentRows(leaseId)).resolves.toHaveLength(1);
	});

	it("rejects a rent payment without a key", async () => {
		const { ownerId, tenantId, propertyId } = await ownerPropertyUnit();
		const { leaseId } = await directLease(propertyId, tenantId, "B07-2");
		const client = clients(ownerId);
		await expect(
			client.createPayment({
				leaseId,
				amount: 10_000_00,
				paymentDate: new Date("2026-09-01T00:00:00.000Z"),
				type: PAYMENT_TYPES.RENT,
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("dedupes a retried utility payment on the same key", async () => {
		const { ownerId, tenantId, propertyId } = await ownerPropertyUnit();
		const { leaseId } = await directLease(propertyId, tenantId, "B07-3");
		const utilityId = await directBill(leaseId);
		const client = clients(ownerId);
		const input = {
			utilityId,
			leaseId,
			amount: 5_00_00,
			paymentMethod: "cash" as const,
			receivedAt: "2026-09-01",
			idempotencyKey: crypto.randomUUID(),
		};
		const first = await client.recordUtilityPayment(input);
		const second = await client.recordUtilityPayment(input);
		expect(second.paymentDate).toEqual(first.paymentDate);
		const rows = await db
			.select({ id: payments.id })
			.from(payments)
			.where(eq(payments.utilityId, utilityId));
		expect(rows).toHaveLength(1);
	});

	it("rejects a utility payment without a key", async () => {
		const { ownerId, tenantId, propertyId } = await ownerPropertyUnit();
		const { leaseId } = await directLease(propertyId, tenantId, "B07-4");
		const utilityId = await directBill(leaseId);
		const client = clients(ownerId);
		await expect(
			client.recordUtilityPayment({
				utilityId,
				leaseId,
				amount: 5_00_00,
				paymentMethod: "cash",
				receivedAt: "2026-09-01",
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("dedupes a retried agreement payment on the same key", async () => {
		const { ownerId, tenantId, propertyId } = await ownerPropertyUnit();
		for (const unitNumber of ["B07-5A", "B07-5B"]) {
			const unitId = crypto.randomUUID();
			createdUnitIds.push(unitId);
			await db.insert(units).values({
				id: unitId,
				propertyId,
				unitNumber,
				type: UNIT_TYPES.ONEBHK,
				baseRent: 1100,
				status: UNIT_STATUSES.AVAILABLE,
			});
		}
		const client = clients(ownerId);
		const madeUnits = await db
			.select({ id: units.id })
			.from(units)
			.where(inArray(units.id, createdUnitIds));
		const { leases: combined } = await client.createCombinedLease({
			tenantId,
			startDate: new Date("2026-09-01T00:00:00.000Z"),
			endDate: new Date("2027-09-01T00:00:00.000Z"),
			units: madeUnits.map((unit) => ({ unitId: unit.id, rent: 1100 })),
		});
		const agreementId = combined[0]?.agreementId as string;
		const key = crypto.randomUUID();
		const first = await client.createAgreementPayment({
			agreementId,
			paymentDate: new Date("2026-09-05T00:00:00.000Z"),
			paymentMethods: "upi",
			idempotencyKey: key,
		});
		createdGroupIds.push(first.paymentGroup.id);
		const second = await client.createAgreementPayment({
			agreementId,
			paymentDate: new Date("2026-09-05T00:00:00.000Z"),
			paymentMethods: "upi",
			idempotencyKey: key,
		});
		expect(second.paymentGroup.id).toBe(first.paymentGroup.id);
		const [storedGroup] = await db
			.select({
				idempotencyKey: paymentGroups.idempotencyKey,
				requestFingerprint: paymentGroups.requestFingerprint,
			})
			.from(paymentGroups)
			.where(eq(paymentGroups.id, first.paymentGroup.id));
		expect(storedGroup?.idempotencyKey).toBe(key);
		expect(storedGroup?.requestFingerprint).toBeTruthy();
		const childKeys = await db
			.select({ idempotencyKey: payments.idempotencyKey })
			.from(payments)
			.where(eq(payments.paymentGroupId, first.paymentGroup.id));
		expect(childKeys.every((payment) => payment.idempotencyKey === null)).toBe(
			true,
		);
	});

	it("does not replay a same key across agreements", async () => {
		const { ownerId, tenantId, propertyId } = await ownerPropertyUnit();
		const secondTenantId = await additionalTenant(ownerId, "Tenant B");
		const firstAgreement = await combinedAgreement(
			ownerId,
			tenantId,
			propertyId,
			"B09-A",
		);
		const secondAgreement = await combinedAgreement(
			ownerId,
			secondTenantId,
			propertyId,
			"B09-B",
		);
		const key = crypto.randomUUID();
		const paymentDate = new Date("2026-09-05T00:00:00.000Z");
		const first = await clients(ownerId).createAgreementPayment({
			agreementId: firstAgreement.agreementId,
			paymentDate,
			paymentMethods: "upi",
			idempotencyKey: key,
		});
		const second = await clients(ownerId).createAgreementPayment({
			agreementId: secondAgreement.agreementId,
			paymentDate,
			paymentMethods: "upi",
			idempotencyKey: key,
		});
		createdGroupIds.push(first.paymentGroup.id, second.paymentGroup.id);

		expect(second.paymentGroup.id).not.toBe(first.paymentGroup.id);
		expect(new Set(second.payments.map((payment) => payment.leaseId))).toEqual(
			new Set(secondAgreement.leases.map((lease) => lease.id)),
		);
	});

	it("does not replay a same key across owners", async () => {
		const firstOwner = await ownerPropertyUnit();
		const secondOwner = await ownerPropertyUnit();
		const firstAgreement = await combinedAgreement(
			firstOwner.ownerId,
			firstOwner.tenantId,
			firstOwner.propertyId,
			"B09-owner-a",
		);
		const secondAgreement = await combinedAgreement(
			secondOwner.ownerId,
			secondOwner.tenantId,
			secondOwner.propertyId,
			"B09-owner-b",
		);
		const key = crypto.randomUUID();
		const paymentDate = new Date("2026-09-05T00:00:00.000Z");
		const first = await clients(firstOwner.ownerId).createAgreementPayment({
			agreementId: firstAgreement.agreementId,
			paymentDate,
			paymentMethods: "upi",
			idempotencyKey: key,
		});
		const second = await clients(secondOwner.ownerId).createAgreementPayment({
			agreementId: secondAgreement.agreementId,
			paymentDate,
			paymentMethods: "upi",
			idempotencyKey: key,
		});
		createdGroupIds.push(first.paymentGroup.id, second.paymentGroup.id);

		expect(second.paymentGroup.id).not.toBe(first.paymentGroup.id);
	});

	it("rejects a same-key replay when the request fingerprint changes", async () => {
		const { ownerId, tenantId, propertyId } = await ownerPropertyUnit();
		const agreement = await combinedAgreement(
			ownerId,
			tenantId,
			propertyId,
			"B09-fingerprint",
		);
		const client = clients(ownerId);
		const key = crypto.randomUUID();
		const first = await client.createAgreementPayment({
			agreementId: agreement.agreementId,
			paymentDate: new Date("2026-09-05T00:00:00.000Z"),
			paymentMethods: "upi",
			referenceNumber: "allocation-request-a",
			idempotencyKey: key,
		});
		createdGroupIds.push(first.paymentGroup.id);

		await expect(
			client.createAgreementPayment({
				agreementId: agreement.agreementId,
				paymentDate: new Date("2026-09-05T00:00:00.000Z"),
				paymentMethods: "upi",
				referenceNumber: "allocation-request-b",
				idempotencyKey: key,
			}),
		).rejects.toMatchObject({ code: "CONFLICT" });
	});

	it("rejects an agreement payment without a key", async () => {
		const { ownerId, tenantId, propertyId } = await ownerPropertyUnit();
		for (const unitNumber of ["B07-6A", "B07-6B"]) {
			const unitId = crypto.randomUUID();
			createdUnitIds.push(unitId);
			await db.insert(units).values({
				id: unitId,
				propertyId,
				unitNumber,
				type: UNIT_TYPES.ONEBHK,
				baseRent: 1100,
				status: UNIT_STATUSES.AVAILABLE,
			});
		}
		const client = clients(ownerId);
		const madeUnits = await db
			.select({ id: units.id })
			.from(units)
			.where(inArray(units.id, createdUnitIds));
		const { leases: combined } = await client.createCombinedLease({
			tenantId,
			startDate: new Date("2026-09-01T00:00:00.000Z"),
			endDate: new Date("2027-09-01T00:00:00.000Z"),
			units: madeUnits.map((unit) => ({ unitId: unit.id, rent: 1100 })),
		});
		await expect(
			client.createAgreementPayment({
				agreementId: combined[0]?.agreementId as string,
				paymentDate: new Date("2026-09-05T00:00:00.000Z"),
				paymentMethods: "upi",
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("dedupes a retried credit on the same key", async () => {
		const { ownerId, tenantId, propertyId } = await ownerPropertyUnit();
		const { leaseId } = await directLease(propertyId, tenantId, "B07-7");
		const client = clients(ownerId);
		const key = crypto.randomUUID();
		const input = {
			leaseId,
			type: CREDIT_TYPES.DISCOUNT,
			amount: -1_00_00,
			reason: "B07 duplicate discount reason",
			idempotencyKey: key,
		} as const;
		const first = await client.createCredit(input);
		const second = await client.createCredit(input);
		expect(second.credit.id).toBe(first.credit.id);
	});

	it("rejects a credit without a key", async () => {
		const { ownerId, tenantId, propertyId } = await ownerPropertyUnit();
		const { leaseId } = await directLease(propertyId, tenantId, "B07-8");
		const client = clients(ownerId);
		await expect(
			client.createCredit({
				leaseId,
				type: CREDIT_TYPES.DISCOUNT,
				amount: -1_00_00,
				reason: "B07 keyless discount reason",
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("dedupes a retried single bill on the same key", async () => {
		const { ownerId, tenantId, propertyId } = await ownerPropertyUnit();
		const { leaseId } = await directLease(propertyId, tenantId, "B07-9");
		const client = clients(ownerId);
		const input = {
			leaseId,
			utilityType: UTILITY_TYPES.ELECTRICITY,
			previousReadingDate: new Date("2026-08-01T00:00:00.000Z"),
			currentReadingDate: new Date("2026-08-31T00:00:00.000Z"),
			previousReading: 100,
			currentReading: 150,
			ratePerUnit: 9,
			fixedCharge: 100_00,
			idempotencyKey: crypto.randomUUID(),
		} as const;
		const first = await client.createUtility(input);
		const second = await client.createUtility(input);
		expect(second.utility.id).toBe(first.utility.id);
		const rows = await db
			.select({ id: utilities.id })
			.from(utilities)
			.where(eq(utilities.leaseId, leaseId));
		expect(rows).toHaveLength(1);
	});

	it("dedupes a retried bill batch on the same item keys", async () => {
		const { ownerId, tenantId, propertyId } = await ownerPropertyUnit();
		const { leaseId } = await directLease(propertyId, tenantId, "B07-10");
		const client = clients(ownerId);
		const batchId = generatedId();
		const input = {
			leaseId,
			batchId,
			items: [
				{
					utilityType: UTILITY_TYPES.ELECTRICITY,
					previousReadingDate: new Date("2026-08-01T00:00:00.000Z"),
					currentReadingDate: new Date("2026-08-31T00:00:00.000Z"),
					previousReading: 100,
					currentReading: 150,
					ratePerUnit: 9,
					fixedCharge: 100_00,
					batchId,
					idempotencyKey: crypto.randomUUID(),
				},
			],
		} as const;
		const first = await client.createUtilityBatch(input);
		const second = await client.createUtilityBatch(input);
		expect(second.utilities.map((u) => u.id).sort()).toEqual(
			first.utilities.map((u) => u.id).sort(),
		);
		const rows = await db
			.select({ id: utilities.id })
			.from(utilities)
			.where(eq(utilities.leaseId, leaseId));
		expect(rows).toHaveLength(1);
	});

	it("rejects a batch item without a key", async () => {
		const { ownerId, tenantId, propertyId } = await ownerPropertyUnit();
		const { leaseId } = await directLease(propertyId, tenantId, "B07-11");
		const client = clients(ownerId);
		const batchId = generatedId();
		await expect(
			client.createUtilityBatch({
				leaseId,
				batchId,
				items: [
					{
						utilityType: UTILITY_TYPES.ELECTRICITY,
						previousReadingDate: new Date("2026-08-01T00:00:00.000Z"),
						currentReadingDate: new Date("2026-08-31T00:00:00.000Z"),
						previousReading: 100,
						currentReading: 150,
						ratePerUnit: 9,
						fixedCharge: 100_00,
						batchId,
					},
				],
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});
