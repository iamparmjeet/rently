// E07 unit occupancy derivation — regression rationale:
// `updateUnit` accepted a `status` patch, so one call could mark a leased
// unit available (or an empty unit occupied) behind the back of the lease
// lifecycle. The transition tests pin the lifecycle paths that must keep
// working once the public patching path is closed; the refusal test is the
// red-precise regression.
import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import {
	PROPERTY_TYPES,
	UNIT_STATUSES,
	UNIT_TYPES,
} from "@rently/db/constants/rent-constants";
import { user } from "@rently/db/schema/auth";
import {
	leaseAgreements,
	leases,
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

import {
	createCombinedLease,
	createLease,
	terminateLease,
	updateLease,
} from "../rent/lease";
import { updateUnit } from "../rent/unit";

const db = createDb();

const createdUserIds: string[] = [];
const createdProfileIds: string[] = [];
const createdPropertyIds: string[] = [];
const createdUnitIds: string[] = [];
const createdLeaseIds: string[] = [];
const createdAgreementIds: string[] = [];

const START = new Date("2026-01-01T00:00:00.000Z");
const END = new Date("2027-01-01T00:00:00.000Z");
const RENT = 10_000_00;

async function ownerWithProperty() {
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
	return { ownerId, tenantId, propertyId };
}

async function availableUnit(propertyId: string, unitNumber: string) {
	const unitId = crypto.randomUUID();
	createdUnitIds.push(unitId);
	await db.insert(units).values({
		id: unitId,
		propertyId,
		unitNumber,
		type: UNIT_TYPES.ONEBHK,
		baseRent: RENT,
		status: UNIT_STATUSES.AVAILABLE,
	});
	return unitId;
}

function clientFor(ownerId: string) {
	mocks.getSession.mockResolvedValue({
		user: { id: ownerId, role: "owner" },
		session: { id: "test-session" },
	});
	const context = { db, headers: new Headers() } as never;
	return createRouterClient(
		{
			createLease,
			createCombinedLease,
			updateLease,
			terminateLease,
			updateUnit,
		},
		{ context },
	);
}

async function unitStatus(unitId: string) {
	const [row] = await db
		.select({ status: units.status })
		.from(units)
		.where(eq(units.id, unitId));
	return row?.status ?? null;
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
	createdLeaseIds.length = 0;
	createdAgreementIds.length = 0;
	createdUnitIds.length = 0;
	createdPropertyIds.length = 0;
	createdProfileIds.length = 0;
	createdUserIds.length = 0;
	mocks.getSession.mockReset();
});

describe("E07 unit occupancy derivation", () => {
	it("refuses a direct status patch on a leased unit and leaves it occupied", async () => {
		const { ownerId, tenantId, propertyId } = await ownerWithProperty();
		const unitId = await availableUnit(propertyId, "E07-REF");
		const created = await clientFor(ownerId).createLease({
			unitId,
			tenantId,
			startDate: START,
			endDate: END,
			rent: RENT,
		});
		if (!created.lease.agreementId)
			throw new Error("Lease created no agreement");
		createdAgreementIds.push(created.lease.agreementId);
		createdLeaseIds.push(created.lease.id);
		expect(await unitStatus(unitId)).toBe("occupied");

		await expect(
			clientFor(ownerId).updateUnit({
				id: unitId,
				data: { status: "available" },
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		expect(await unitStatus(unitId)).toBe("occupied");
	});

	it("frees the unit on terminate and re-occupies it on reactivation", async () => {
		const { ownerId, tenantId, propertyId } = await ownerWithProperty();
		const unitId = await availableUnit(propertyId, "E07-CYC");
		const created = await clientFor(ownerId).createLease({
			unitId,
			tenantId,
			startDate: START,
			endDate: END,
			rent: RENT,
		});
		if (!created.lease.agreementId)
			throw new Error("Lease created no agreement");
		createdAgreementIds.push(created.lease.agreementId);
		createdLeaseIds.push(created.lease.id);

		await clientFor(ownerId).terminateLease({ id: created.lease.id });
		expect(await unitStatus(unitId)).toBe("available");

		await clientFor(ownerId).updateLease({
			id: created.lease.id,
			data: { status: "active" },
		});
		expect(await unitStatus(unitId)).toBe("occupied");
	});

	it("frees only the terminated child of a combined agreement", async () => {
		const { ownerId, tenantId, propertyId } = await ownerWithProperty();
		const unitA = await availableUnit(propertyId, "E07-CMB-A");
		const unitB = await availableUnit(propertyId, "E07-CMB-B");
		const result = await clientFor(ownerId).createCombinedLease({
			tenantId,
			startDate: START,
			endDate: END,
			units: [
				{ unitId: unitA, rent: RENT },
				{ unitId: unitB, rent: RENT },
			],
		});
		const agreementId = result.leases[0]?.agreementId;
		if (!agreementId) throw new Error("Combined lease created no agreement");
		createdAgreementIds.push(agreementId);
		createdLeaseIds.push(...result.leases.map((lease) => lease.id));
		const firstChild = result.leases[0];
		if (!firstChild) throw new Error("Combined lease created no children");

		await clientFor(ownerId).terminateLease({ id: firstChild.id });

		expect(await unitStatus(unitA)).toBe("available");
		expect(await unitStatus(unitB)).toBe("occupied");
	});

	it("keeps ordinary non-status unit edits working on an occupied unit", async () => {
		const { ownerId, tenantId, propertyId } = await ownerWithProperty();
		const unitId = await availableUnit(propertyId, "E07-EDIT");
		const created = await clientFor(ownerId).createLease({
			unitId,
			tenantId,
			startDate: START,
			endDate: END,
			rent: RENT,
		});
		if (!created.lease.agreementId)
			throw new Error("Lease created no agreement");
		createdAgreementIds.push(created.lease.agreementId);
		createdLeaseIds.push(created.lease.id);

		const result = await clientFor(ownerId).updateUnit({
			id: unitId,
			data: { baseRent: RENT * 2, description: "Renovated" },
		});

		expect(result.unit.baseRent).toBe(RENT * 2);
		expect(await unitStatus(unitId)).toBe("occupied");
	});
});
