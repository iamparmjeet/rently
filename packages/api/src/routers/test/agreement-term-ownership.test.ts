// E05 agreement/child-lease update separation — regression rationale:
// `updateLease` writes dates onto ONE child row while the parent agreement
// and sibling children keep the old shared terms, so a single-child edit
// silently diverges a combined agreement. Each test below maps to one half
// of the done criteria: children cannot diverge on shared terms.
import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import {
	LEASE_STATUSES,
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
	updateAgreement,
	updateLease,
} from "../rent/lease";

const db = createDb();

const createdUserIds: string[] = [];
const createdProfileIds: string[] = [];
const createdPropertyIds: string[] = [];
const createdUnitIds: string[] = [];
const createdLeaseIds: string[] = [];
const createdAgreementIds: string[] = [];

const START = new Date("2026-01-01T00:00:00.000Z");
const END = new Date("2027-01-01T00:00:00.000Z");
const NEW_END = new Date("2027-06-01T00:00:00.000Z");

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
		baseRent: 10_000_00,
		status: UNIT_STATUSES.AVAILABLE,
	});
	return unitId;
}

function clientFor(ownerId: string, database: typeof db = db) {
	mocks.getSession.mockResolvedValue({
		user: { id: ownerId, role: "owner" },
		session: { id: "test-session" },
	});
	const context = { db: database, headers: new Headers() } as never;
	return createRouterClient(
		{ createLease, createCombinedLease, updateLease, updateAgreement },
		{ context },
	);
}

// This shim selects the same supportsBatch branch used by Neon HTTP while
// retaining the disposable local Postgres connection (D04 precedent). Real
// Neon batches map query-builder rows through the column mappers (camelCase
// keys, Date objects); node's tx.execute returns raw snake_case rows with
// unparsed timestamp strings, so re-apply that mapping here — the handlers
// under test feed builder rows into drizzle output schemas.
function neonPathDatabase() {
	const toCamel = (key: string) =>
		key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
	const timestampKeys = new Set([
		"start_date",
		"end_date",
		"created_at",
		"updated_at",
	]);
	// pg returns timestamp-without-tz as a naive "YYYY-MM-DD HH:MM:SS" string.
	// Drizzle's own mapper reads it as UTC; parse it the same way so shimmed
	// batch rows match node-path rows exactly.
	const parseTimestamp = (value: string) =>
		new Date(
			/Z|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value.replace(" ", "T")}Z`,
		);
	const mapRow = (row: Record<string, unknown>) =>
		Object.fromEntries(
			Object.entries(row).map(([key, value]) => [
				toCamel(key),
				timestampKeys.has(key) && typeof value === "string"
					? parseTimestamp(value)
					: value,
			]),
		);
	return new Proxy(db, {
		get(target, property, receiver) {
			if (property === "batch") {
				return (queries: Array<{ getSQL: () => unknown }>) =>
					target.transaction(async (tx) => {
						const results = [];
						for (const query of queries) {
							const raw = await tx.execute(query.getSQL() as never);
							const rows = (raw.rows ?? raw) as Array<Record<string, unknown>>;
							results.push(rows.map(mapRow));
						}
						return results;
					});
			}
			return Reflect.get(target, property, receiver);
		},
	});
}

async function combinedFixture(prefix: string) {
	const { ownerId, tenantId, propertyId } = await ownerWithProperty();
	const unitA = await availableUnit(propertyId, `${prefix}-A`);
	const unitB = await availableUnit(propertyId, `${prefix}-B`);
	const result = await clientFor(ownerId).createCombinedLease({
		tenantId,
		startDate: START,
		endDate: END,
		units: [
			{ unitId: unitA, rent: 10_000_00 },
			{ unitId: unitB, rent: 12_000_00 },
		],
	});
	const agreementId = result.leases[0]?.agreementId;
	if (!agreementId) throw new Error("Combined lease created no agreement");
	createdAgreementIds.push(agreementId);
	createdLeaseIds.push(...result.leases.map((lease) => lease.id));
	return { ownerId, tenantId, agreementId, leases: result.leases };
}

async function agreementRow(agreementId: string) {
	const [row] = await db
		.select()
		.from(leaseAgreements)
		.where(eq(leaseAgreements.id, agreementId));
	return row ?? null;
}

async function childEndDates(agreementId: string) {
	return db
		.select({ id: leases.id, endDate: leases.endDate })
		.from(leases)
		.where(eq(leases.agreementId, agreementId));
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

describe("E05 agreement/child-lease update separation", () => {
	it("updates the agreement and every child together", async () => {
		const {
			ownerId,
			agreementId,
			leases: children,
		} = await combinedFixture("E05-ALL");

		const result = await clientFor(ownerId).updateAgreement({
			id: agreementId,
			data: { endDate: NEW_END },
		});

		expect(result.agreement.endDate).toEqual(NEW_END);
		expect(result.leases).toHaveLength(2);
		const after = await childEndDates(agreementId);
		expect(after).toHaveLength(2);
		for (const child of after) expect(child.endDate).toEqual(NEW_END);
		const childIds = new Set(children.map((lease) => lease.id));
		for (const child of after) expect(childIds.has(child.id)).toBe(true);
	});

	it("refuses a shared-term edit on one child of a combined agreement and changes nothing", async () => {
		const {
			ownerId,
			agreementId,
			leases: children,
		} = await combinedFixture("E05-ONE");
		const firstChild = children[0];
		if (!firstChild) throw new Error("Combined lease created no children");

		await expect(
			clientFor(ownerId).updateLease({
				id: firstChild.id,
				data: { endDate: NEW_END },
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		const after = await childEndDates(agreementId);
		for (const child of after) expect(child.endDate).toEqual(END);
		expect((await agreementRow(agreementId))?.endDate).toEqual(END);
	});

	it("propagates date edits to the parent of an independent agreement", async () => {
		const { ownerId, tenantId, propertyId } = await ownerWithProperty();
		const unitId = await availableUnit(propertyId, "E05-IND");
		const created = await clientFor(ownerId).createLease({
			unitId,
			tenantId,
			startDate: START,
			endDate: END,
			rent: 10_000_00,
		});
		const agreementId = created.lease.agreementId;
		if (!agreementId) throw new Error("Lease created no agreement");
		createdAgreementIds.push(agreementId);
		createdLeaseIds.push(created.lease.id);

		await clientFor(ownerId).updateLease({
			id: created.lease.id,
			data: { endDate: NEW_END },
		});

		const [child] = await db
			.select()
			.from(leases)
			.where(eq(leases.id, created.lease.id));
		expect(child?.endDate).toEqual(NEW_END);
		expect((await agreementRow(agreementId))?.endDate).toEqual(NEW_END);
	});

	it("refuses a cross-owner agreement update without writing", async () => {
		const { agreementId } = await combinedFixture("E05-XOWN");
		const { ownerId: otherOwnerId } = await ownerWithProperty();

		await expect(
			clientFor(otherOwnerId).updateAgreement({
				id: agreementId,
				data: { endDate: NEW_END },
			}),
		).rejects.toMatchObject({ code: "FORBIDDEN" });

		expect((await agreementRow(agreementId))?.endDate).toEqual(END);
	});

	it("rejects an end date before the start date on the merged agreement", async () => {
		const { ownerId, agreementId } = await combinedFixture("E05-ORD");

		await expect(
			clientFor(ownerId).updateAgreement({
				id: agreementId,
				data: { endDate: new Date("2025-06-01T00:00:00.000Z") },
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		expect((await agreementRow(agreementId))?.endDate).toEqual(END);
	});

	it("leaves agreement-less lease date edits working", async () => {
		const { ownerId, tenantId, propertyId } = await ownerWithProperty();
		const unitId = await availableUnit(propertyId, "E05-LEG");
		const leaseId = crypto.randomUUID();
		createdLeaseIds.push(leaseId);
		await db.insert(leases).values({
			id: leaseId,
			unitId,
			tenantId,
			startDate: START,
			endDate: END,
			rent: 10_000_00,
			status: LEASE_STATUSES.ACTIVE,
		});

		const result = await clientFor(ownerId).updateLease({
			id: leaseId,
			data: { endDate: NEW_END },
		});

		expect(result.lease.endDate).toEqual(NEW_END);
	});

	it("Neon batch updates the agreement and every child together", async () => {
		const { ownerId, agreementId } = await combinedFixture("E05-NEON");

		const result = await clientFor(
			ownerId,
			neonPathDatabase() as typeof db,
		).updateAgreement({
			id: agreementId,
			data: { endDate: NEW_END },
		});

		expect(result.agreement.endDate).toEqual(NEW_END);
		const after = await childEndDates(agreementId);
		expect(after).toHaveLength(2);
		for (const child of after) expect(child.endDate).toEqual(NEW_END);
	});

	it("Neon batch propagates independent date edits to the parent", async () => {
		const { ownerId, tenantId, propertyId } = await ownerWithProperty();
		const unitId = await availableUnit(propertyId, "E05-NIND");
		const created = await clientFor(ownerId).createLease({
			unitId,
			tenantId,
			startDate: START,
			endDate: END,
			rent: 10_000_00,
		});
		const agreementId = created.lease.agreementId;
		if (!agreementId) throw new Error("Lease created no agreement");
		createdAgreementIds.push(agreementId);
		createdLeaseIds.push(created.lease.id);

		const result = await clientFor(
			ownerId,
			neonPathDatabase() as typeof db,
		).updateLease({
			id: created.lease.id,
			data: { endDate: NEW_END },
		});

		expect(result.lease.endDate).toEqual(NEW_END);
		expect((await agreementRow(agreementId))?.endDate).toEqual(NEW_END);
	});
});
