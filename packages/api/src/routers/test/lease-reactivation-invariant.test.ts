// E06 reactivation status-only — regression rationale:
// `updateLease` let a terminated→active transition carry rent, deposit, or
// date changes, silently repricing a closed lease's historical terms. Each
// test below maps to one half of the done criteria: financial terms cannot
// be rewritten through reactivation, while the active-unit conflict guard
// and genuine status-only reactivations keep working.
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

import { createLease, terminateLease, updateLease } from "../rent/lease";

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
		{ createLease, updateLease, terminateLease },
		{ context },
	);
}

async function terminatedLease(prefix: string) {
	const { ownerId, tenantId, propertyId } = await ownerWithProperty();
	const unitId = await availableUnit(propertyId, `${prefix}-U`);
	const created = await clientFor(ownerId).createLease({
		unitId,
		tenantId,
		startDate: START,
		endDate: END,
		rent: RENT,
	});
	if (!created.lease.agreementId) throw new Error("Lease created no agreement");
	createdAgreementIds.push(created.lease.agreementId);
	createdLeaseIds.push(created.lease.id);
	await clientFor(ownerId).terminateLease({ id: created.lease.id });
	return { ownerId, leaseId: created.lease.id, unitId };
}

async function leaseRow(leaseId: string) {
	const [row] = await db.select().from(leases).where(eq(leases.id, leaseId));
	return row ?? null;
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

describe("E06 reactivation status-only", () => {
	it("refuses rent and deposit changes during reactivation and leaves the lease terminated", async () => {
		const { ownerId, leaseId } = await terminatedLease("E06-MONEY");

		await expect(
			clientFor(ownerId).updateLease({
				id: leaseId,
				data: { status: "active", rent: 1_00_00, deposit: 0 },
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		const row = await leaseRow(leaseId);
		expect(row?.status).toBe("terminated");
		expect(row?.rent).toBe(RENT);
	});

	it("refuses date changes during reactivation and keeps the stored dates", async () => {
		const { ownerId, leaseId } = await terminatedLease("E06-DATE");

		await expect(
			clientFor(ownerId).updateLease({
				id: leaseId,
				data: {
					status: "active",
					endDate: new Date("2028-01-01T00:00:00.000Z"),
				},
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		const row = await leaseRow(leaseId);
		expect(row?.status).toBe("terminated");
		expect(row?.endDate).toEqual(END);
	});

	it("keeps the active-unit conflict protection on reactivation", async () => {
		const { ownerId, tenantId, propertyId } = await ownerWithProperty();
		const unitId = await availableUnit(propertyId, "E06-CONF");
		const first = await clientFor(ownerId).createLease({
			unitId,
			tenantId,
			startDate: START,
			endDate: END,
			rent: RENT,
		});
		if (!first.lease.agreementId) throw new Error("Lease created no agreement");
		createdAgreementIds.push(first.lease.agreementId);
		createdLeaseIds.push(first.lease.id);
		await clientFor(ownerId).terminateLease({ id: first.lease.id });
		const second = await clientFor(ownerId).createLease({
			unitId,
			tenantId,
			startDate: START,
			endDate: END,
			rent: RENT,
		});
		if (!second.lease.agreementId)
			throw new Error("Lease created no agreement");
		createdAgreementIds.push(second.lease.agreementId);
		createdLeaseIds.push(second.lease.id);

		await expect(
			clientFor(ownerId).updateLease({
				id: first.lease.id,
				data: { status: "active" },
			}),
		).rejects.toMatchObject({ code: "CONFLICT" });

		expect((await leaseRow(first.lease.id))?.status).toBe("terminated");
	});

	it("allows a status-only reactivation with terms intact", async () => {
		const { ownerId, leaseId, unitId } = await terminatedLease("E06-OK");

		const result = await clientFor(ownerId).updateLease({
			id: leaseId,
			data: { status: "active" },
		});

		expect(result.lease.status).toBe("active");
		expect(result.lease.rent).toBe(RENT);
		expect(result.lease.endDate).toEqual(END);
		const [unit] = await db
			.select({ status: units.status })
			.from(units)
			.where(eq(units.id, unitId));
		expect(unit?.status).toBe("occupied");
	});
});
