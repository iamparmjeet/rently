import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import { CREDIT_TYPES } from "@rently/db/constants/payment-constants";
import {
	LEASE_STATUSES,
	PROPERTY_TYPES,
	UNIT_STATUSES,
	UNIT_TYPES,
} from "@rently/db/constants/rent-constants";
import { user } from "@rently/db/schema/auth";
import {
	billCredits,
	leases,
	properties,
	tenantProfiles,
	units,
} from "@rently/db/schema/schema";
import { generatedId } from "@rently/db/utils/id";
import { and, eq, inArray, isNull } from "drizzle-orm";
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

import { reverseCredit } from "../rent/credit";

const db = createDb();

// Full id suffix: uuidv7 ids share a timestamp prefix, so a short prefix
// collides on the credit_note_no unique constraint within milliseconds.
const noteNo = (id: string) =>
	`KQ-CN-${id.replaceAll("-", "").slice(-12).toUpperCase()}`;

const createdUserIds: string[] = [];
const createdProfileIds: string[] = [];
const createdPropertyIds: string[] = [];
const createdUnitIds: string[] = [];

async function createDiscountFixture() {
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
	const unitId = crypto.randomUUID();
	createdUnitIds.push(unitId);
	await db.insert(units).values({
		id: unitId,
		propertyId,
		unitNumber: `B06-${unitId.slice(0, 4)}`,
		type: UNIT_TYPES.ONEBHK,
		baseRent: 10_000_00,
		status: UNIT_STATUSES.AVAILABLE,
	});
	const leaseId = crypto.randomUUID();
	await db.insert(leases).values({
		id: leaseId,
		unitId,
		tenantId,
		startDate: new Date("2026-01-01T00:00:00.000Z"),
		endDate: new Date("2027-01-01T00:00:00.000Z"),
		rent: 10_000_00,
		status: LEASE_STATUSES.ACTIVE,
	});
	const creditId = generatedId();
	await db.insert(billCredits).values({
		id: creditId,
		leaseId,
		ownerId,
		type: CREDIT_TYPES.DISCOUNT,
		amount: -5_00_00,
		reason: "B06 test discount reason",
		creditNoteNo: noteNo(creditId),
		createdBy: ownerId,
	});
	mocks.getSession.mockResolvedValue({
		user: { id: ownerId, role: "owner" },
		session: { id: "test-session" },
	});
	const context = { db, headers: new Headers() } as never;
	const client = createRouterClient({ reverseCredit }, { context });
	return { client, creditId, leaseId };
}

async function reversalRows(creditId: string) {
	return db
		.select({ id: billCredits.id })
		.from(billCredits)
		.where(
			and(
				eq(billCredits.reversesCreditId, creditId),
				isNull(billCredits.reversedAt),
			),
		);
}

afterEach(async () => {
	if (createdUnitIds.length > 0) {
		const leaseRows = await db
			.select({ id: leases.id })
			.from(leases)
			.where(inArray(leases.unitId, createdUnitIds));
		const leaseIds = leaseRows.map((row) => row.id);
		if (leaseIds.length > 0) {
			await db
				.delete(billCredits)
				.where(inArray(billCredits.leaseId, leaseIds));
			await db.delete(leases).where(inArray(leases.id, leaseIds));
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
	mocks.getSession.mockReset();
});

describe("atomic credit reversal (B06)", () => {
	it("lets exactly one of two simultaneous reversals create the row", async () => {
		const { client, creditId } = await createDiscountFixture();
		const [first, second] = await Promise.all([
			client.reverseCredit({ creditId }),
			client.reverseCredit({ creditId }),
		]);
		expect(first.reversal.id).toBe(second.reversal.id);
		expect(first.reversal.reversesCreditId).toBe(creditId);
		await expect(reversalRows(creditId)).resolves.toHaveLength(1);
	});

	it("returns the existing reversal on retry after timeout", async () => {
		const { client, creditId } = await createDiscountFixture();
		const { reversal } = await client.reverseCredit({ creditId });
		const retry = await client.reverseCredit({ creditId });
		expect(retry.reversal.id).toBe(reversal.id);
		await expect(reversalRows(creditId)).resolves.toHaveLength(1);
	});

	it("completes a partially applied reversal instead of duplicating it", async () => {
		const { client, creditId, leaseId } = await createDiscountFixture();
		// Simulate a crashed batch: reversal row exists, original unmarked.
		const partialId = generatedId();
		await db.insert(billCredits).values({
			id: partialId,
			leaseId,
			ownerId: createdUserIds[0] as string,
			type: CREDIT_TYPES.DISCOUNT,
			amount: 5_00_00,
			reason: "B06 partial reversal row",
			creditNoteNo: noteNo(partialId),
			reversesCreditId: creditId,
			createdBy: createdUserIds[0] as string,
		});
		const { reversal } = await client.reverseCredit({ creditId });
		expect(reversal.id).toBe(partialId);
		const [original] = await db
			.select({ reversedAt: billCredits.reversedAt })
			.from(billCredits)
			.where(eq(billCredits.id, creditId));
		expect(original?.reversedAt).not.toBeNull();
		await expect(reversalRows(creditId)).resolves.toHaveLength(1);
	});

	it("marks the original reversed and links the reversal", async () => {
		const { client, creditId } = await createDiscountFixture();
		const { credit, reversal } = await client.reverseCredit({ creditId });
		expect(reversal.reversesCreditId).toBe(creditId);
		expect(reversal.amount).toBe(5_00_00);
		expect(credit.reversedAt).not.toBeNull();
	});
});

describe("one-reversal-per-credit invariant (B06) — database", () => {
	it("rejects a second reversal row for the same credit", async () => {
		const { client, creditId, leaseId } = await createDiscountFixture();
		await client.reverseCredit({ creditId });
		await expect(
			db.insert(billCredits).values({
				leaseId,
				ownerId: createdUserIds[0] as string,
				type: CREDIT_TYPES.DISCOUNT,
				amount: 5_00_00,
				reason: "B06 duplicate reversal row",
				creditNoteNo: noteNo(generatedId()),
				reversesCreditId: creditId,
				createdBy: createdUserIds[0] as string,
			}),
		).rejects.toMatchObject({ cause: { code: "23505" } });
	});
});
