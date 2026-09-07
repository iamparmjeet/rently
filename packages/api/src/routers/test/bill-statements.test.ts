// H01 server-issued statements — regression rationale:
// The printable combined bill took an arbitrary `?ids=` utility list and
// rendered whatever it named as one bill — mixed tenants, leases, or months
// printed under a single bill number with a summed total. Issue and read now
// go through a server statement that locks the composition (one owner, one
// lease, one month) and computes every amount; the page renders only what
// the statement returns.
import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import {
	PROPERTY_TYPES,
	UNIT_TYPES,
} from "@rently/db/constants/rent-constants";
import { user } from "@rently/db/schema/auth";
import {
	billStatements,
	leases,
	properties,
	rentAllocations,
	rentCharges,
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

import { getBillStatement, issueBillStatement } from "../rent/statement";

const db = createDb();

const createdUserIds: string[] = [];
const createdProfileIds: string[] = [];
const createdPropertyIds: string[] = [];
const createdUnitIds: string[] = [];
const createdLeaseIds: string[] = [];
const createdUtilityIds: string[] = [];
const createdStatementIds: string[] = [];

async function ownerWithTenant(name: string, unitNumber: string) {
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
		name: `Tenant ${name}`,
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
		unitNumber,
		type: UNIT_TYPES.ONEBHK,
		baseRent: 10_000_00,
		status: "occupied",
	});
	const leaseId = crypto.randomUUID();
	createdLeaseIds.push(leaseId);
	await db.insert(leases).values({
		id: leaseId,
		unitId,
		tenantId,
		startDate: new Date("2026-01-01T00:00:00.000Z"),
		endDate: new Date("2027-01-01T00:00:00.000Z"),
		rent: 10_000_00,
		status: "active",
		rentDueDate: 10,
	});
	return { ownerId, tenantId, leaseId };
}

async function insertBill(leaseId: string, readingDate: string) {
	const billId = crypto.randomUUID();
	createdUtilityIds.push(billId);
	await db.insert(utilities).values({
		id: billId,
		leaseId,
		utilityType: "electricity",
		previousReading: 100,
		currentReading: 150,
		previousReadingDate: new Date("2026-08-01T00:00:00.000Z"),
		currentReadingDate: new Date(`${readingDate}T00:00:00.000Z`),
		unitsUsed: 50,
		ratePerUnit: 900,
		fixedCharge: 10000,
		totalAmount: 55000,
		isPaid: false,
	});
	return billId;
}

function clientFor(ownerId: string) {
	mocks.getSession.mockResolvedValue({
		user: { id: ownerId, role: "owner" },
		session: { id: "test-session" },
	});
	const context = { db, headers: new Headers() } as never;
	return createRouterClient(
		{ issueBillStatement, getBillStatement },
		{ context },
	);
}

async function statementCount() {
	return db.select({ id: billStatements.id }).from(billStatements);
}

afterEach(async () => {
	if (createdStatementIds.length > 0) {
		await db
			.delete(billStatements)
			.where(inArray(billStatements.id, createdStatementIds));
	}
	if (createdUtilityIds.length > 0) {
		await db.delete(utilities).where(inArray(utilities.id, createdUtilityIds));
	}
	if (createdLeaseIds.length > 0) {
		// Statement reads accrue period charges for the lease.
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
	createdStatementIds.length = 0;
	createdUtilityIds.length = 0;
	createdLeaseIds.length = 0;
	createdUnitIds.length = 0;
	createdPropertyIds.length = 0;
	createdProfileIds.length = 0;
	createdUserIds.length = 0;
	mocks.getSession.mockReset();
});

describe("H01 server-issued statements", () => {
	it("returns server-computed amounts for the locked composition", async () => {
		const { ownerId, leaseId } = await ownerWithTenant("A", "H01-A");
		const first = await insertBill(leaseId, "2026-09-04");
		const second = await insertBill(leaseId, "2026-09-05");
		const issued = await clientFor(ownerId).issueBillStatement({
			utilityIds: [first, second],
		});
		createdStatementIds.push(issued.id);

		const { statement } = await clientFor(ownerId).getBillStatement({
			id: issued.id,
		});
		const recomputed =
			statement.utilities.reduce(
				(sum, bill) => sum + (bill.amountDue ?? 0),
				0,
			) + statement.rentDue;
		expect(statement.statementTotal).toBe(recomputed);
		expect(statement.utilities.map((bill) => bill.id).sort()).toEqual(
			[first, second].sort(),
		);
	});

	it("refuses bills spanning two tenants", async () => {
		const first = await ownerWithTenant("A", "H01-B1");
		const billA = await insertBill(first.leaseId, "2026-09-04");
		// Same owner, second tenant relationship.
		const tenantId = crypto.randomUUID();
		createdUserIds.push(tenantId);
		await db.insert(user).values({
			id: tenantId,
			name: "Tenant C",
			email: `${tenantId}@test.keyhq.invalid`,
			role: "tenant",
		});
		const profileId = crypto.randomUUID();
		createdProfileIds.push(profileId);
		await db.insert(tenantProfiles).values({
			id: profileId,
			userId: tenantId,
			createdById: first.ownerId,
		});
		const unitId = crypto.randomUUID();
		createdUnitIds.push(unitId);
		const propertyId = createdPropertyIds[0];
		if (!propertyId) throw new Error("Fixture created no property");
		await db.insert(units).values({
			id: unitId,
			propertyId,
			unitNumber: "H01-B3",
			type: UNIT_TYPES.ONEBHK,
			baseRent: 10_000_00,
			status: "occupied",
		});
		const leaseId = crypto.randomUUID();
		createdLeaseIds.push(leaseId);
		await db.insert(leases).values({
			id: leaseId,
			unitId,
			tenantId,
			startDate: new Date("2026-01-01T00:00:00.000Z"),
			endDate: new Date("2027-01-01T00:00:00.000Z"),
			rent: 10_000_00,
			status: "active",
			rentDueDate: 10,
		});
		const billC = await insertBill(leaseId, "2026-09-06");

		await expect(
			clientFor(first.ownerId).issueBillStatement({
				utilityIds: [billA, billC],
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(await statementCount()).toHaveLength(0);
	});

	it("refuses bills spanning two periods", async () => {
		const { ownerId, leaseId } = await ownerWithTenant("A", "H01-C");
		const september = await insertBill(leaseId, "2026-09-04");
		const august = await insertBill(leaseId, "2026-08-04");

		await expect(
			clientFor(ownerId).issueBillStatement({
				utilityIds: [september, august],
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(await statementCount()).toHaveLength(0);
	});

	it("refuses another owner's bills and statements", async () => {
		const first = await ownerWithTenant("A", "H01-D1");
		const second = await ownerWithTenant("B", "H01-D2");
		const billA = await insertBill(first.leaseId, "2026-09-04");
		const issued = await clientFor(first.ownerId).issueBillStatement({
			utilityIds: [billA],
		});
		createdStatementIds.push(issued.id);

		await expect(
			clientFor(second.ownerId).issueBillStatement({ utilityIds: [billA] }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			clientFor(second.ownerId).getBillStatement({ id: issued.id }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect(await statementCount()).toHaveLength(1);
	});

	it("refuses expired and unknown statement ids", async () => {
		const { ownerId, leaseId } = await ownerWithTenant("A", "H01-E");
		const bill = await insertBill(leaseId, "2026-09-04");
		const issued = await clientFor(ownerId).issueBillStatement({
			utilityIds: [bill],
		});
		createdStatementIds.push(issued.id);

		await expect(
			clientFor(ownerId).getBillStatement({ id: crypto.randomUUID() }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });

		await db
			.update(billStatements)
			.set({ expiresAt: new Date("2020-01-01T00:00:00.000Z") })
			.where(eq(billStatements.id, issued.id));
		await expect(
			clientFor(ownerId).getBillStatement({ id: issued.id }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});
