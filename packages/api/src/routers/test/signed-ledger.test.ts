import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import {
	LEASE_AGREEMENT_ARRANGEMENT,
	LEASE_CATEGORY,
	LEASE_STATUSES,
	PAYMENT_TYPES,
	PROPERTY_TYPES,
	UNIT_STATUSES,
	UNIT_TYPES,
	UTILITY_TYPES,
} from "@rently/db/constants/rent-constants";
import { user } from "@rently/db/schema/auth";
import {
	leaseAgreements,
	leases,
	paymentGroups,
	payments,
	properties,
	units,
	utilities,
} from "@rently/db/schema/schema";
import { generatedId } from "@rently/db/utils/id";
import { inArray } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queryRentCycleRows } from "../../scheduled-reminders";
import {
	getAmountDueForRent,
	getAmountDueForUtility,
} from "../helpers/credit.helpers";
import { queryOverdueLeases } from "../helpers/overdue-query";
import { getSignedLedgerPayments } from "../helpers/signed-ledger";
import { getRevenueDashboard } from "../rent/stats";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
}));

vi.mock("@rently/auth", () => ({
	auth: {
		api: {
			getSession: mocks.getSession,
		},
	},
}));

const db = createDb();

const created = {
	users: [] as string[],
	properties: [] as string[],
	units: [] as string[],
	agreements: [] as string[],
	leases: [] as string[],
	utilities: [] as string[],
	groups: [] as string[],
	payments: [] as string[],
};

async function createFixture() {
	const ownerId = generatedId();
	const tenantId = generatedId();
	const propertyId = generatedId();
	const unitId = generatedId();
	const agreementId = generatedId();
	const leaseId = generatedId();
	const utilityId = generatedId();
	const groupId = generatedId();
	created.users.push(ownerId, tenantId);
	created.properties.push(propertyId);
	created.units.push(unitId);
	created.agreements.push(agreementId);
	created.leases.push(leaseId);
	created.utilities.push(utilityId);
	created.groups.push(groupId);

	await db.insert(user).values([
		{
			id: ownerId,
			name: "Ledger Owner",
			email: `${ownerId}@test.keyhq.invalid`,
			role: "owner",
		},
		{
			id: tenantId,
			name: "Ledger Tenant",
			email: `${tenantId}@test.keyhq.invalid`,
			role: "tenant",
		},
	]);
	await db.insert(properties).values({
		id: propertyId,
		ownerId,
		name: "Ledger Property",
		address: "1 Test Road",
		type: PROPERTY_TYPES.RESIDENTIAL,
	});
	await db.insert(units).values({
		id: unitId,
		propertyId,
		unitNumber: "LEDGER-1",
		type: UNIT_TYPES.ONEBHK,
		baseRent: 100_000,
		status: UNIT_STATUSES.OCCUPIED,
	});
	await db.insert(leaseAgreements).values({
		id: agreementId,
		tenantId,
		propertyId,
		arrangementType: LEASE_AGREEMENT_ARRANGEMENT.COMBINED,
		category: LEASE_CATEGORY.RESIDENTIAL,
		startDate: new Date("2026-01-01T00:00:00.000Z"),
	});
	await db.insert(leases).values({
		id: leaseId,
		unitId,
		tenantId,
		agreementId,
		startDate: new Date("2026-01-01T00:00:00.000Z"),
		rent: 100_000,
		rentDueDate: 10,
		status: LEASE_STATUSES.ACTIVE,
	});
	await db.insert(utilities).values({
		id: utilityId,
		leaseId,
		utilityType: UTILITY_TYPES.ELECTRICITY,
		currentReadingDate: new Date("2026-09-01T00:00:00.000Z"),
		previousReading: 0,
		currentReading: 10,
		unitsUsed: 10,
		ratePerUnit: 10,
		fixedCharge: 0,
		totalAmount: 100_000,
	});

	// The group deliberately mixes rent and deposit allocations. Its reversal
	// must inherit each original category rather than becoming rent by default.
	await db.insert(paymentGroups).values({
		id: groupId,
		agreementId,
		paymentDate: new Date("2026-09-01T00:00:00.000Z"),
	});

	return { ownerId, leaseId, utilityId, groupId };
}

afterEach(async () => {
	if (created.payments.length) {
		await db.delete(payments).where(inArray(payments.id, created.payments));
	}
	if (created.groups.length) {
		await db
			.delete(paymentGroups)
			.where(inArray(paymentGroups.id, created.groups));
	}
	if (created.utilities.length) {
		await db.delete(utilities).where(inArray(utilities.id, created.utilities));
	}
	if (created.leases.length) {
		await db.delete(leases).where(inArray(leases.id, created.leases));
	}
	if (created.agreements.length) {
		await db
			.delete(leaseAgreements)
			.where(inArray(leaseAgreements.id, created.agreements));
	}
	if (created.units.length) {
		await db.delete(units).where(inArray(units.id, created.units));
	}
	if (created.properties.length) {
		await db
			.delete(properties)
			.where(inArray(properties.id, created.properties));
	}
	if (created.users.length) {
		await db.delete(user).where(inArray(user.id, created.users));
	}

	for (const ids of Object.values(created)) ids.length = 0;
	mocks.getSession.mockReset();
	vi.useRealTimers();
});

describe("signed ledger reads", () => {
	it("attributes rent, deposit, utility, and other reversals to their originals", async () => {
		const { ownerId, leaseId, utilityId, groupId } = await createFixture();
		const rentId = generatedId();
		const rentReversalId = generatedId();
		const depositId = generatedId();
		const depositReversalId = generatedId();
		const otherId = generatedId();
		const otherReversalId = generatedId();
		const utilityIdToReverse = generatedId();
		const utilityReversalId = generatedId();
		const partialUtilityId = generatedId();
		created.payments.push(
			rentId,
			rentReversalId,
			depositId,
			depositReversalId,
			otherId,
			otherReversalId,
			utilityIdToReverse,
			utilityReversalId,
			partialUtilityId,
		);

		await db.insert(payments).values([
			{
				id: rentId,
				leaseId,
				amount: 100_000,
				paymentDate: new Date("2026-09-01T00:00:00.000Z"),
				type: PAYMENT_TYPES.RENT,
				paymentGroupId: groupId,
			},
			{
				id: rentReversalId,
				leaseId,
				amount: -100_000,
				paymentDate: new Date("2026-09-02T00:00:00.000Z"),
				type: PAYMENT_TYPES.REVERSAL,
				referenceNumber: rentId,
				reversesPaymentId: rentId,
				paymentGroupId: groupId,
			},
			{
				id: depositId,
				leaseId,
				amount: 20_000,
				paymentDate: new Date("2026-09-01T00:00:00.000Z"),
				type: PAYMENT_TYPES.DEPOSIT,
				paymentGroupId: groupId,
			},
			{
				id: depositReversalId,
				leaseId,
				amount: -20_000,
				paymentDate: new Date("2026-09-02T00:00:00.000Z"),
				type: PAYMENT_TYPES.REVERSAL,
				referenceNumber: depositId,
				reversesPaymentId: depositId,
				paymentGroupId: groupId,
			},
			{
				id: otherId,
				leaseId,
				amount: 10_000,
				paymentDate: new Date("2026-09-01T00:00:00.000Z"),
				type: PAYMENT_TYPES.OTHER,
			},
			{
				id: otherReversalId,
				leaseId,
				amount: -10_000,
				paymentDate: new Date("2026-09-02T00:00:00.000Z"),
				type: PAYMENT_TYPES.REVERSAL,
				referenceNumber: otherId,
				reversesPaymentId: otherId,
			},
			{
				id: utilityIdToReverse,
				leaseId,
				utilityId,
				amount: 30_000,
				paymentDate: new Date("2026-09-01T00:00:00.000Z"),
				type: PAYMENT_TYPES.UTILITY,
			},
			{
				id: utilityReversalId,
				leaseId,
				utilityId,
				amount: -30_000,
				paymentDate: new Date("2026-09-02T00:00:00.000Z"),
				type: PAYMENT_TYPES.REVERSAL,
				referenceNumber: utilityIdToReverse,
				reversesPaymentId: utilityIdToReverse,
			},
			{
				id: partialUtilityId,
				leaseId,
				utilityId,
				amount: 25_000,
				paymentDate: new Date("2026-09-03T00:00:00.000Z"),
				type: PAYMENT_TYPES.UTILITY,
			},
		]);

		const rows = await getSignedLedgerPayments(db, { leaseIds: [leaseId] });
		const byId = new Map(rows.map((row) => [row.id, row]));
		expect(byId.get(rentReversalId)).toMatchObject({
			amount: -100_000,
			type: PAYMENT_TYPES.REVERSAL,
			category: PAYMENT_TYPES.RENT,
		});
		expect(byId.get(depositReversalId)?.category).toBe(PAYMENT_TYPES.DEPOSIT);
		expect(byId.get(otherReversalId)?.category).toBe(PAYMENT_TYPES.OTHER);
		expect(byId.get(utilityReversalId)?.category).toBe(PAYMENT_TYPES.UTILITY);

		// Rent is lifetime in this phase: the rent pair nets to zero, while the
		// mixed deposit/other group never contributes to rent.
		await expect(getAmountDueForRent(db, leaseId)).resolves.toBe(100_000);
		// Utility has a reversed 30,000 attempt plus a live 25,000 partial payment.
		await expect(getAmountDueForUtility(db, utilityId)).resolves.toBe(75_000);

		const overdue = await queryOverdueLeases(
			db,
			new Date("2026-09-13T00:00:00.000Z"),
			ownerId,
		);
		expect(overdue).toEqual([
			expect.objectContaining({
				leaseId,
				paidAmount: 0,
				outstandingAmount: 100_000,
			}),
		]);

		const reminderRows = await queryRentCycleRows(
			db,
			new Date("2026-09-05T00:00:00.000Z"),
			ownerId,
		);
		expect(reminderRows).toEqual([
			expect.objectContaining({ leaseId, paidAmount: 0 }),
		]);
	});

	it("nets signed revenue and keeps reversal rows in recent activity", async () => {
		const { ownerId, leaseId, utilityId, groupId } = await createFixture();
		const rentId = generatedId();
		const rentReversalId = generatedId();
		const utilityPaymentId = generatedId();
		created.payments.push(rentId, rentReversalId, utilityPaymentId);
		await db.insert(payments).values([
			{
				id: rentId,
				leaseId,
				amount: 100_000,
				paymentDate: new Date("2026-09-01T00:00:00.000Z"),
				type: PAYMENT_TYPES.RENT,
				paymentGroupId: groupId,
			},
			{
				id: rentReversalId,
				leaseId,
				amount: -100_000,
				paymentDate: new Date("2026-09-02T00:00:00.000Z"),
				type: PAYMENT_TYPES.REVERSAL,
				referenceNumber: rentId,
				reversesPaymentId: rentId,
				paymentGroupId: groupId,
			},
			{
				id: utilityPaymentId,
				leaseId,
				utilityId,
				amount: 25_000,
				paymentDate: new Date("2026-09-03T00:00:00.000Z"),
				type: PAYMENT_TYPES.UTILITY,
			},
		]);

		mocks.getSession.mockResolvedValue({
			user: {
				id: ownerId,
				name: "Ledger Owner",
				email: `${ownerId}@test.keyhq.invalid`,
				role: "owner",
			},
			session: { id: "signed-ledger-session" },
		});
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-09-05T00:00:00.000Z"));

		const result = await createRouterClient(
			{ getRevenueDashboard },
			{ context: { db, headers: new Headers() } },
		).getRevenueDashboard();

		expect(result.totalThisMonth).toBe(25_000);
		expect(result.recentTransactions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: rentReversalId,
					type: PAYMENT_TYPES.REVERSAL,
					amount: -100_000,
				}),
			]),
		);
	});
});
