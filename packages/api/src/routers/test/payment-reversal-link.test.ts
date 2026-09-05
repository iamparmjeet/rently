import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import {
	LEASE_STATUSES,
	PAYMENT_TYPES,
	PROPERTY_TYPES,
	UNIT_STATUSES,
	UNIT_TYPES,
} from "@rently/db/constants/rent-constants";
import { user } from "@rently/db/schema/auth";
import {
	leaseAgreements,
	leases,
	paymentGroups,
	payments,
	properties,
	tenantProfiles,
	units,
} from "@rently/db/schema/schema";
import { generatedId } from "@rently/db/utils/id";
import { inArray, sql } from "drizzle-orm";
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

import { createCombinedLease, createLease } from "../rent/lease";
import {
	createAgreementPayment,
	createPayment,
	voidPayment,
	voidPaymentGroup,
} from "../rent/payment";

const db = createDb();

const repoRoot = path.resolve(
	fileURLToPath(new URL(".", import.meta.url)),
	"../../../../..",
);

const createdUserIds: string[] = [];
const createdProfileIds: string[] = [];
const createdPropertyIds: string[] = [];
const createdUnitIds: string[] = [];
const createdGroupIds: string[] = [];

async function createOwnerWithTenant() {
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

async function createAvailableUnit(
	propertyId: string,
	unitNumber: string,
	baseRent = 10_000_00,
) {
	const unitId = crypto.randomUUID();
	createdUnitIds.push(unitId);
	await db.insert(units).values({
		id: unitId,
		propertyId,
		unitNumber,
		type: UNIT_TYPES.ONEBHK,
		baseRent,
		status: UNIT_STATUSES.AVAILABLE,
	});
	return unitId;
}

function leaseClient(ownerId: string) {
	mocks.getSession.mockResolvedValue({
		user: { id: ownerId, role: "owner" },
		session: { id: "test-session" },
	});
	const context = { db, headers: new Headers() } as never;
	return createRouterClient({ createCombinedLease }, { context });
}

function paymentClient(ownerId: string) {
	mocks.getSession.mockResolvedValue({
		user: { id: ownerId, role: "owner" },
		session: { id: "test-session" },
	});
	const context = { db, headers: new Headers() } as never;
	return createRouterClient(
		{ createPayment, voidPayment, createAgreementPayment, voidPaymentGroup },
		{ context },
	);
}

afterEach(async () => {
	// Derive from fixture units so pre-fix rows are removed too.
	if (createdUnitIds.length > 0) {
		const leaseRows = await db
			.select({ id: leases.id, agreementId: leases.agreementId })
			.from(leases)
			.where(inArray(leases.unitId, createdUnitIds));
		const leaseIds = leaseRows.map((row) => row.id);
		if (leaseIds.length > 0) {
			await db.delete(payments).where(inArray(payments.leaseId, leaseIds));
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

function migrationSql(): string {
	const dir = path.join(repoRoot, "packages/db/src/schema/migrations");
	const file = readdirSync(dir).find((name) => /^0025_.*\.sql$/.test(name));
	expect(file, "B03 migration file present").toBeDefined();
	return readFileSync(path.join(dir, file as string), "utf8");
}

describe("payment reversal linkage (B03) — migration", () => {
	it("ships a backfill that links unambiguous reversals only", () => {
		const ddl = migrationSql();
		expect(ddl).toContain("reverses_payment_id");
		expect(ddl).toMatch(/update\s+"?payments"?/i);
		expect(ddl).toContain("reference_number");
	});

	it("executes the backfill update cleanly", async () => {
		const ddl = migrationSql();
		const updates = ddl
			.split("--> statement-breakpoint")
			.map((s) => s.trim())
			.filter((s) => /^update\b/i.test(s));
		expect(updates.length).toBeGreaterThan(0);
		for (const statement of updates) {
			await db.execute(sql.raw(statement));
		}
	});
});

describe("payment reversal linkage (B03) — writers", () => {
	it("links a single void to its original and retains the reference", async () => {
		const { ownerId, tenantId, propertyId } = await createOwnerWithTenant();
		const unitId = await createAvailableUnit(propertyId, "B03-1");
		const leasesApi = createRouterClient(
			{ createLease },
			{ context: { db, headers: new Headers() } as never },
		);
		const { lease } = await leasesApi.createLease({
			unitId,
			tenantId,
			startDate: new Date("2026-01-01T00:00:00.000Z"),
			endDate: new Date("2027-01-01T00:00:00.000Z"),
			rent: 10_000_00,
		});
		const client = paymentClient(ownerId);
		const paid = await client.createPayment({
			leaseId: lease.id,
			amount: 10_000_00,
			paymentDate: new Date("2026-09-01T00:00:00.000Z"),
			type: PAYMENT_TYPES.RENT,
			idempotencyKey: crypto.randomUUID(),
		});
		const { reversal } = await client.voidPayment({ id: paid.payment.id });
		expect(reversal.reversesPaymentId).toBe(paid.payment.id);
		expect(reversal.referenceNumber).toBe(paid.payment.id);
		expect(reversal.type).toBe(PAYMENT_TYPES.REVERSAL);
	});

	it("links every grouped void allocation to its original", async () => {
		const { ownerId, tenantId, propertyId } = await createOwnerWithTenant();
		const unitA = await createAvailableUnit(propertyId, "B03-A", 1100);
		const unitB = await createAvailableUnit(propertyId, "B03-B", 1900);
		const leasesApi = leaseClient(ownerId);
		const { leases: combined } = await leasesApi.createCombinedLease({
			tenantId,
			startDate: new Date("2026-09-01T00:00:00.000Z"),
			endDate: new Date("2027-09-01T00:00:00.000Z"),
			units: [
				{ unitId: unitA, rent: 1100 },
				{ unitId: unitB, rent: 1900 },
			],
		});
		const client = paymentClient(ownerId);
		const agreementId = combined[0]?.agreementId;
		expect(agreementId).toBeDefined();
		const grouped = await client.createAgreementPayment({
			agreementId: agreementId as string,
			paymentDate: new Date("2026-09-05T00:00:00.000Z"),
			paymentMethods: "upi",
			idempotencyKey: crypto.randomUUID(),
		});
		createdGroupIds.push(grouped.paymentGroup.id);
		const { reversals } = await client.voidPaymentGroup({
			id: grouped.paymentGroup.id,
		});
		createdGroupIds.push(reversals[0]?.paymentGroupId as string);
		const originalIds = new Set(grouped.payments.map((p) => p.id));
		expect(reversals).toHaveLength(grouped.payments.length);
		for (const row of reversals) {
			expect(row.referenceNumber).not.toBeNull();
			expect(row.reversesPaymentId).not.toBeNull();
			expect(originalIds.has(row.reversesPaymentId as string)).toBe(true);
			expect(row.reversesPaymentId).toBe(row.referenceNumber);
		}
	});

	it("supports void-then-repay with exactly one linked reversal", async () => {
		const { ownerId, tenantId, propertyId } = await createOwnerWithTenant();
		const unitId = await createAvailableUnit(propertyId, "B03-2");
		const leasesApi = createRouterClient(
			{ createLease },
			{ context: { db, headers: new Headers() } as never },
		);
		const { lease } = await leasesApi.createLease({
			unitId,
			tenantId,
			startDate: new Date("2026-01-01T00:00:00.000Z"),
			endDate: new Date("2027-01-01T00:00:00.000Z"),
			rent: 10_000_00,
		});
		const client = paymentClient(ownerId);
		const first = await client.createPayment({
			leaseId: lease.id,
			amount: 10_000_00,
			paymentDate: new Date("2026-09-01T00:00:00.000Z"),
			type: PAYMENT_TYPES.RENT,
			idempotencyKey: crypto.randomUUID(),
		});
		await client.voidPayment({ id: first.payment.id });
		const repaid = await client.createPayment({
			leaseId: lease.id,
			amount: 10_000_00,
			paymentDate: new Date("2026-09-02T00:00:00.000Z"),
			type: PAYMENT_TYPES.RENT,
			idempotencyKey: crypto.randomUUID(),
		});
		expect(repaid.payment.type).toBe(PAYMENT_TYPES.RENT);
		expect(repaid.payment.reversesPaymentId).toBeNull();
		const rows = await db
			.select({ id: payments.id, type: payments.type })
			.from(payments)
			.where(inArray(payments.leaseId, [lease.id]));
		const linked = rows.filter((row) => row.type === PAYMENT_TYPES.REVERSAL);
		expect(linked).toHaveLength(1);
	});
});

describe("payment reversal linkage (B03) — database", () => {
	it("rejects an unlinked reversal and a linked non-reversal", async () => {
		const { propertyId } = await createOwnerWithTenant();
		const unitId = await createAvailableUnit(propertyId, "B03-3");
		const leaseId = crypto.randomUUID();
		await db.insert(leases).values({
			id: leaseId,
			unitId,
			tenantId: createdUserIds[1] as string,
			startDate: new Date("2026-01-01T00:00:00.000Z"),
			rent: 10_000_00,
			status: LEASE_STATUSES.ACTIVE,
		});
		await expect(
			db.insert(payments).values({
				id: generatedId(),
				leaseId,
				amount: -1_00_00,
				paymentDate: new Date("2026-09-01T00:00:00.000Z"),
				type: PAYMENT_TYPES.REVERSAL,
			}),
		).rejects.toMatchObject({ cause: { code: "23514" } });
		await expect(
			db.insert(payments).values({
				id: generatedId(),
				leaseId,
				amount: 1_00_00,
				paymentDate: new Date("2026-09-01T00:00:00.000Z"),
				type: PAYMENT_TYPES.RENT,
				reversesPaymentId: generatedId(),
			}),
		).rejects.toMatchObject({ cause: { code: "23514" } });
	});

	it("blocks deleting a referenced original but allows deleting the reversal", async () => {
		const { propertyId } = await createOwnerWithTenant();
		const unitId = await createAvailableUnit(propertyId, "B03-4");
		const leaseId = crypto.randomUUID();
		await db.insert(leases).values({
			id: leaseId,
			unitId,
			tenantId: createdUserIds[1] as string,
			startDate: new Date("2026-01-01T00:00:00.000Z"),
			rent: 10_000_00,
			status: LEASE_STATUSES.ACTIVE,
		});
		const originalId = generatedId();
		await db.insert(payments).values({
			id: originalId,
			leaseId,
			amount: 1_00_00,
			paymentDate: new Date("2026-09-01T00:00:00.000Z"),
			type: PAYMENT_TYPES.RENT,
		});
		const reversalId = generatedId();
		await db.insert(payments).values({
			id: reversalId,
			leaseId,
			amount: -1_00_00,
			paymentDate: new Date("2026-09-02T00:00:00.000Z"),
			type: PAYMENT_TYPES.REVERSAL,
			referenceNumber: originalId,
			reversesPaymentId: originalId,
		});
		await expect(
			db.delete(payments).where(inArray(payments.id, [originalId])),
		).rejects.toMatchObject({ cause: { code: "23503" } });
		await db.delete(payments).where(inArray(payments.id, [reversalId]));
		await db.delete(payments).where(inArray(payments.id, [originalId]));
	});

	it("reports unlinked reversals for follow-up", async () => {
		const result = await db.execute(
			sql`select id from ${payments} where ${payments.type} = 'reversal' and ${payments.reversesPaymentId} is null`,
		);
		expect(Array.isArray(result.rows) ? result.rows : result).toEqual([]);
	});
});
