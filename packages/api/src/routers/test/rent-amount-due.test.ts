import { createDb } from "@rently/db";
import {
	LEASE_STATUSES,
	PAYMENT_TYPES,
	PROPERTY_TYPES,
	UNIT_STATUSES,
	UNIT_TYPES,
} from "@rently/db/constants/rent-constants";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import { user } from "@rently/db/schema/auth";
import { leases, payments, properties, units } from "@rently/db/schema/schema";
import { inArray } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { getAmountDueForRent } from "../helpers/credit.helpers";

const db = createDb();

const created = {
	userIds: [] as string[],
	propertyIds: [] as string[],
	unitIds: [] as string[],
	leaseIds: [] as string[],
	paymentIds: [] as string[],
};

afterEach(async () => {
	if (created.paymentIds.length > 0) {
		await db.delete(payments).where(inArray(payments.id, created.paymentIds));
	}
	if (created.leaseIds.length > 0) {
		await db.delete(leases).where(inArray(leases.id, created.leaseIds));
	}
	if (created.unitIds.length > 0) {
		await db.delete(units).where(inArray(units.id, created.unitIds));
	}
	if (created.propertyIds.length > 0) {
		await db
			.delete(properties)
			.where(inArray(properties.id, created.propertyIds));
	}
	if (created.userIds.length > 0) {
		await db.delete(user).where(inArray(user.id, created.userIds));
	}

	for (const ids of Object.values(created)) ids.length = 0;
});

describe("getAmountDueForRent", () => {
	it("nets rent reversals without counting deposits toward rent", async () => {
		const ownerId = crypto.randomUUID();
		const tenantId = crypto.randomUUID();
		created.userIds.push(ownerId, tenantId);
		await db.insert(user).values([
			{
				id: ownerId,
				name: "Rent Due Owner",
				email: `${ownerId}@test.keyhq.invalid`,
				role: USER_ROLES.OWNER,
			},
			{
				id: tenantId,
				name: "Rent Due Tenant",
				email: `${tenantId}@test.keyhq.invalid`,
				role: USER_ROLES.TENANT,
			},
		]);

		const propertyId = crypto.randomUUID();
		created.propertyIds.push(propertyId);
		await db.insert(properties).values({
			id: propertyId,
			ownerId,
			name: "Rent Due Property",
			address: "1 Test Road",
			type: PROPERTY_TYPES.RESIDENTIAL,
		});

		const unitId = crypto.randomUUID();
		created.unitIds.push(unitId);
		await db.insert(units).values({
			id: unitId,
			propertyId,
			unitNumber: "DUE-1",
			type: UNIT_TYPES.ONEBHK,
			baseRent: 120_000,
			status: UNIT_STATUSES.OCCUPIED,
		});

		const leaseId = crypto.randomUUID();
		created.leaseIds.push(leaseId);
		await db.insert(leases).values({
			id: leaseId,
			unitId,
			tenantId,
			startDate: new Date("2026-09-01T00:00:00.000Z"),
			rent: 120_000,
			status: LEASE_STATUSES.ACTIVE,
		});

		// PostgreSQL returns SUM(integer) as a bigint string. Zero aggregate rows
		// must not turn 120000 + "0" into the reported 1200000 paise.
		await expect(getAmountDueForRent(db, leaseId)).resolves.toBe(120_000);

		const incorrectRentId = crypto.randomUUID();
		const rentReversalId = crypto.randomUUID();
		const depositId = crypto.randomUUID();
		created.paymentIds.push(incorrectRentId, rentReversalId, depositId);
		await db.insert(payments).values([
			{
				id: incorrectRentId,
				leaseId,
				amount: 1_200_000,
				paymentDate: new Date("2026-09-02T00:00:00.000Z"),
				type: PAYMENT_TYPES.RENT,
			},
			{
				id: rentReversalId,
				leaseId,
				amount: -1_200_000,
				paymentDate: new Date("2026-09-03T00:00:00.000Z"),
				type: PAYMENT_TYPES.REVERSAL,
				referenceNumber: incorrectRentId,
			},
			{
				id: depositId,
				leaseId,
				amount: 500_000,
				paymentDate: new Date("2026-09-01T00:00:00.000Z"),
				type: PAYMENT_TYPES.DEPOSIT,
			},
		]);

		await expect(getAmountDueForRent(db, leaseId)).resolves.toBe(120_000);
	});
});
