// E08 live-resource scoping — regression rationale:
// Archiving (soft-delete) must make a property/unit historical-only, but the
// ownership gates and creation paths never filtered `deletedAt` consistently:
// `createUnit` accepted an archived property, `updateProperty` edited one,
// `VerifyUnitOwnership` ignored the property's flag, `isLeaseOwner` /
// `VerifyLeaseOwnership` ignored both flags (so payments, credits, and utility
// bills could still be raised on archived resources), `createLease` /
// `createCombinedLease` accepted archived units, and `listUnits` / `getUnits`
// / `getUnitById` surfaced deleted rows. Each test below pins one boundary;
// the archival flows use the real API (terminate → deleteUnit →
// deleteProperty) wherever reachable, and direct `deletedAt` surgery only
// where the API itself prevents the state (a live unit under an archived
// property — reachable pre-fix through `createUnit`, closed by this slice).
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
	payments,
	properties,
	rentAllocations,
	rentCharges,
	tenantProfiles,
	units,
} from "@rently/db/schema/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
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
} from "../rent/lease";
import { createPayment } from "../rent/payment";
import {
	createProperty,
	deleteProperty,
	getUnits,
	updateProperty,
} from "../rent/property";
import {
	createUnit,
	deleteUnit,
	getUnitById,
	listUnits,
	updateUnit,
} from "../rent/unit";

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
			createProperty,
			updateProperty,
			deleteProperty,
			getUnits,
			createUnit,
			updateUnit,
			deleteUnit,
			getUnitById,
			listUnits,
			createLease,
			createCombinedLease,
			terminateLease,
			createPayment,
		},
		{ context },
	);
}

async function liveUnitCount(propertyId: string) {
	return db
		.select({ id: units.id })
		.from(units)
		.where(and(eq(units.propertyId, propertyId), isNull(units.deletedAt)));
}

afterEach(async () => {
	// Sweep leases reachable from tracked units too: red-state creation paths
	// may write leases the test never saw returned.
	if (createdUnitIds.length > 0 || createdPropertyIds.length > 0) {
		if (createdPropertyIds.length > 0) {
			const strays = await db
				.select({ id: units.id })
				.from(units)
				.where(inArray(units.propertyId, createdPropertyIds));
			for (const stray of strays) {
				if (!createdUnitIds.includes(stray.id)) createdUnitIds.push(stray.id);
			}
		}
		const strays = await db
			.select({ id: leases.id })
			.from(leases)
			.where(inArray(leases.unitId, createdUnitIds));
		for (const stray of strays) {
			if (!createdLeaseIds.includes(stray.id)) createdLeaseIds.push(stray.id);
		}
	}
	if (createdLeaseIds.length > 0) {
		// Allocations reference both charges and payments — clear them before
		// either parent table.
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
		await db.delete(payments).where(inArray(payments.leaseId, createdLeaseIds));
		await db
			.delete(rentCharges)
			.where(inArray(rentCharges.leaseId, createdLeaseIds));
		await db.delete(leases).where(inArray(leases.id, createdLeaseIds));
	}
	if (createdAgreementIds.length > 0 || createdPropertyIds.length > 0) {
		if (createdPropertyIds.length > 0) {
			const strays = await db
				.select({ id: leaseAgreements.id })
				.from(leaseAgreements)
				.where(inArray(leaseAgreements.propertyId, createdPropertyIds));
			for (const stray of strays) {
				if (!createdAgreementIds.includes(stray.id))
					createdAgreementIds.push(stray.id);
			}
		}
		if (createdAgreementIds.length > 0) {
			await db
				.delete(leaseAgreements)
				.where(inArray(leaseAgreements.id, createdAgreementIds));
		}
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

describe("E08 live-resource scoping", () => {
	it("refuses unit creation under an archived property", async () => {
		const { ownerId, propertyId } = await ownerWithProperty();
		const api = clientFor(ownerId);
		await api.deleteProperty({ id: propertyId });

		await expect(
			api.createUnit({
				propertyId,
				unitNumber: "E08-NEW",
				type: UNIT_TYPES.ONEBHK,
				baseRent: RENT,
			}),
		).rejects.toMatchObject({ code: "NOT_FOUND" });

		expect(await liveUnitCount(propertyId)).toHaveLength(0);
	});

	it("refuses property updates once the property is archived", async () => {
		const { ownerId, propertyId } = await ownerWithProperty();
		const api = clientFor(ownerId);
		await api.deleteProperty({ id: propertyId });

		await expect(
			api.updateProperty({ id: propertyId, data: { name: "Renamed" } }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });

		const [row] = await db
			.select({ name: properties.name })
			.from(properties)
			.where(eq(properties.id, propertyId));
		expect(row?.name).toBe("Palm Residency");
	});

	it("treats a live unit under an archived property as gone", async () => {
		const { ownerId, propertyId } = await ownerWithProperty();
		await clientFor(ownerId).deleteProperty({ id: propertyId });
		// Surgery: pre-fix `createUnit` could plant this state; the gates must
		// still refuse it once the creation path is closed.
		const unitId = await availableUnit(propertyId, "E08-GHOST");
		const api = clientFor(ownerId);

		await expect(
			api.updateUnit({ id: unitId, data: { baseRent: RENT * 2 } }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(api.getUnitById({ id: unitId })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});

		const listed = await api.listUnits({});
		expect(listed.units.map((unit) => unit.id)).not.toContain(unitId);
	});

	it("refuses lease creation on an archived unit", async () => {
		const { ownerId, tenantId, propertyId } = await ownerWithProperty();
		const unitId = await availableUnit(propertyId, "E08-DEL");
		const api = clientFor(ownerId);
		await api.deleteUnit({ id: unitId });

		await expect(
			api.createLease({
				unitId,
				tenantId,
				startDate: START,
				endDate: END,
				rent: RENT,
			}),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("refuses a combined lease naming an archived unit", async () => {
		const { ownerId, tenantId, propertyId } = await ownerWithProperty();
		const unitA = await availableUnit(propertyId, "E08-CMB-A");
		const unitB = await availableUnit(propertyId, "E08-CMB-B");
		const api = clientFor(ownerId);
		await api.deleteUnit({ id: unitB });

		await expect(
			api.createCombinedLease({
				tenantId,
				startDate: START,
				endDate: END,
				units: [
					{ unitId: unitA, rent: RENT },
					{ unitId: unitB, rent: RENT },
				],
			}),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("refuses settlement on a historical lease once its resources are archived", async () => {
		const { ownerId, tenantId, propertyId } = await ownerWithProperty();
		const unitId = await availableUnit(propertyId, "E08-HIST");
		const api = clientFor(ownerId);
		const created = await api.createLease({
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

		await api.terminateLease({ id: created.lease.id });
		await api.deleteUnit({ id: unitId });
		await api.deleteProperty({ id: propertyId });

		await expect(
			api.createPayment({
				leaseId: created.lease.id,
				amount: 100_00,
				paymentDate: new Date(),
				paymentMethods: "upi",
				idempotencyKey: crypto.randomUUID(),
			}),
		).rejects.toMatchObject({ code: "FORBIDDEN" });

		const rows = await db
			.select({ id: payments.id })
			.from(payments)
			.where(eq(payments.leaseId, created.lease.id));
		expect(rows).toHaveLength(0);
	});

	it("hides deleted units from property lists and archived properties entirely", async () => {
		const { ownerId, propertyId } = await ownerWithProperty();
		const liveUnit = await availableUnit(propertyId, "E08-LIVE");
		const deadUnit = await availableUnit(propertyId, "E08-DEAD");
		const api = clientFor(ownerId);
		await api.deleteUnit({ id: deadUnit });

		const listed = await api.getUnits({ propertyId });
		expect(listed.units.map((unit) => unit.id)).toEqual([liveUnit]);

		await api.deleteUnit({ id: liveUnit });
		await api.deleteProperty({ id: propertyId });
		await expect(api.getUnits({ propertyId })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
	});
});
