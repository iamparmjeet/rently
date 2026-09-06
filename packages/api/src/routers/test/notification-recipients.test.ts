// F01 notification recipients — regression rationale:
// `createCombinedLease` and `createAgreementPayment` addressed their
// notifications to the tenant, but every read path is owner-only and the
// tenant app has no notification surface — those rows were visible to
// nobody. Both events concern the owner's books, so the fix addresses them
// to the acting owner, making every notification readable in the owner bell.
import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import {
	PROPERTY_TYPES,
	UNIT_TYPES,
} from "@rently/db/constants/rent-constants";
import { user } from "@rently/db/schema/auth";
import {
	leaseAgreements,
	leases,
	notifications,
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

import { listNotifications } from "../notification";
import { createCombinedLease } from "../rent/lease";
import { createAgreementPayment } from "../rent/payment";

const db = createDb();

const createdUserIds: string[] = [];
const createdProfileIds: string[] = [];
const createdPropertyIds: string[] = [];
const createdUnitIds: string[] = [];
const createdLeaseIds: string[] = [];
const createdAgreementIds: string[] = [];
const createdGroupIds: string[] = [];

const START = new Date("2026-01-01T00:00:00.000Z");
const END = new Date("2027-01-01T00:00:00.000Z");
const RENT = 10_000_00;

async function ownerWithTenant() {
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
	for (const unitNumber of ["F01-A", "F01-B"]) {
		const unitId = crypto.randomUUID();
		createdUnitIds.push(unitId);
		await db.insert(units).values({
			id: unitId,
			propertyId,
			unitNumber,
			type: UNIT_TYPES.ONEBHK,
			baseRent: RENT,
			status: "available",
		});
	}
	return { ownerId, tenantId, propertyId };
}

function clientFor(ownerId: string) {
	mocks.getSession.mockResolvedValue({
		user: { id: ownerId, role: "owner" },
		session: { id: "test-session" },
	});
	const context = { db, headers: new Headers() } as never;
	return createRouterClient(
		{ createCombinedLease, createAgreementPayment, listNotifications },
		{ context },
	);
}

async function combinedFixture(ownerId: string, tenantId: string) {
	const unitIds = [...createdUnitIds];
	const result = await clientFor(ownerId).createCombinedLease({
		tenantId,
		startDate: START,
		endDate: END,
		units: unitIds.map((unitId) => ({ unitId, rent: RENT })),
	});
	const agreementId = result.leases[0]?.agreementId;
	if (!agreementId) throw new Error("Combined lease created no agreement");
	createdAgreementIds.push(agreementId);
	createdLeaseIds.push(...result.leases.map((lease) => lease.id));
	return agreementId;
}

async function tenantAddressedCount(tenantId: string) {
	return db
		.select({ id: notifications.id })
		.from(notifications)
		.where(eq(notifications.userId, tenantId));
}

afterEach(async () => {
	// Allocations reference both charges and payments — clear them before
	// either parent table.
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
	}
	if (createdGroupIds.length > 0) {
		await db
			.delete(payments)
			.where(inArray(payments.paymentGroupId, createdGroupIds));
		await db
			.delete(paymentGroups)
			.where(inArray(paymentGroups.id, createdGroupIds));
	}
	if (createdLeaseIds.length > 0) {
		await db.delete(payments).where(inArray(payments.leaseId, createdLeaseIds));
		await db
			.delete(rentCharges)
			.where(inArray(rentCharges.leaseId, createdLeaseIds));
		await db
			.delete(notifications)
			.where(
				inArray(notifications.entityId, [
					...createdLeaseIds,
					...createdAgreementIds,
					...createdGroupIds,
				]),
			);
		await db.delete(leases).where(inArray(leases.id, createdLeaseIds));
	}
	if (createdAgreementIds.length > 0) {
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
	createdGroupIds.length = 0;
	createdLeaseIds.length = 0;
	createdAgreementIds.length = 0;
	createdUnitIds.length = 0;
	createdPropertyIds.length = 0;
	createdProfileIds.length = 0;
	createdUserIds.length = 0;
	mocks.getSession.mockReset();
});

describe("F01 notification recipients", () => {
	it("shows the combined-lease notification in the owner's bell", async () => {
		const { ownerId, tenantId } = await ownerWithTenant();
		const agreementId = await combinedFixture(ownerId, tenantId);

		const listed = await clientFor(ownerId).listNotifications();
		const created = listed.notifications.find(
			(notification) => notification.entityId === agreementId,
		);
		expect(created?.type).toBe("combined_agreement_created");
		expect(await tenantAddressedCount(tenantId)).toHaveLength(0);
	});

	it("shows the agreement-payment notification in the owner's bell", async () => {
		const { ownerId, tenantId } = await ownerWithTenant();
		const agreementId = await combinedFixture(ownerId, tenantId);
		const { paymentGroup } = await clientFor(ownerId).createAgreementPayment({
			agreementId,
			paymentDate: new Date(),
			paymentMethods: "upi",
			idempotencyKey: crypto.randomUUID(),
		});
		createdGroupIds.push(paymentGroup.id);

		const listed = await clientFor(ownerId).listNotifications();
		const created = listed.notifications.find(
			(notification) => notification.entityId === paymentGroup.id,
		);
		expect(created?.type).toBe("grouped_payment_received");
		expect(await tenantAddressedCount(tenantId)).toHaveLength(0);
	});
});
