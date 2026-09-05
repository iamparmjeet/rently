import { createRouterClient } from "@orpc/server";
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
import { generatedId } from "@rently/db/utils/id";
import { inArray } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

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

import {
	exportOwnerPayments,
	exportTenantPayments,
} from "../rent/payment-export";

const db = createDb();

const createdUserIds: string[] = [];
const createdPropertyIds: string[] = [];
const createdUnitIds: string[] = [];
const createdLeaseIds: string[] = [];

type TestUser = {
	id: string;
	name: string;
	email: string;
	role: "owner" | "tenant";
};

async function createUser(
	role: TestUser["role"],
	name: string,
): Promise<TestUser> {
	const id = crypto.randomUUID();
	const email = `${id}@test.keyhq.invalid`;

	createdUserIds.push(id);

	await db.insert(user).values({
		id,
		name,
		email,
		role,
	});

	return { id, name, email, role };
}

function clientFor(authUser: TestUser) {
	mocks.getSession.mockResolvedValue({
		user: authUser,
		session: { id: "test-session" },
	});

	return createRouterClient(
		{
			exportOwnerPayments,
			exportTenantPayments,
		},
		{
			context: {
				db,
				headers: new Headers(),
			},
		},
	);
}

interface LeaseFixtureOptions {
	owner: TestUser;
	tenant: TestUser;
	propertyName?: string;
	unitNumber?: string;
	status?: "active" | "expired" | "terminated";
	endDate?: Date | null;
}

async function createLeaseFixture({
	owner,
	tenant,
	propertyName = "Palm Residency",
	unitNumber = "A-204",
	status = LEASE_STATUSES.ACTIVE,
	endDate = null,
}: LeaseFixtureOptions) {
	const propertyId = generatedId();
	const unitId = generatedId();
	const leaseId = generatedId();

	createdPropertyIds.push(propertyId);
	createdUnitIds.push(unitId);
	createdLeaseIds.push(leaseId);

	await db.insert(properties).values({
		id: propertyId,
		ownerId: owner.id,
		name: propertyName,
		address: "1 Test Road, Mumbai",
		type: PROPERTY_TYPES.RESIDENTIAL,
	});

	await db.insert(units).values({
		id: unitId,
		propertyId,
		unitNumber,
		type: UNIT_TYPES.ONEBHK,
		baseRent: 25_000_00,
		status: UNIT_STATUSES.OCCUPIED,
	});

	await db.insert(leases).values({
		id: leaseId,
		unitId,
		tenantId: tenant.id,
		startDate: new Date("2025-04-01T00:00:00.000Z"),
		endDate,
		rent: 25_000_00,
		status,
	});

	return { leaseId, propertyId, unitId };
}

interface PaymentOptions {
	amount?: number;
	paymentDate: Date;
	type?: "rent" | "utility" | "deposit" | "other" | "reversal";
	paymentMethods?:
		| "upi"
		| "cash"
		| "bank_transfer"
		| "cheque"
		| "online"
		| null;
	referenceNumber?: string | null;
	reversesPaymentId?: string | null;
	description?: string | null;
	createdAt?: Date;
}

async function createPayment(leaseId: string, options: PaymentOptions) {
	const id = generatedId();

	await db.insert(payments).values({
		id,
		leaseId,
		amount: options.amount ?? 25_000_00,
		paymentDate: options.paymentDate,
		type: options.type ?? PAYMENT_TYPES.RENT,
		paymentMethods: options.paymentMethods,
		referenceNumber: options.referenceNumber,
		reversesPaymentId: options.reversesPaymentId ?? null,
		description: options.description,
		createdAt: options.createdAt,
	});

	return id;
}

afterEach(async () => {
	if (createdLeaseIds.length > 0) {
		await db.delete(payments).where(inArray(payments.leaseId, createdLeaseIds));
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

	if (createdUserIds.length > 0) {
		await db.delete(user).where(inArray(user.id, createdUserIds));
	}

	createdLeaseIds.length = 0;
	createdUnitIds.length = 0;
	createdPropertyIds.length = 0;
	createdUserIds.length = 0;
	mocks.getSession.mockReset();
});

describe("payment exports", () => {
	it("returns an enriched signed ledger through inclusive IST date boundaries", async () => {
		const owner = await createUser(USER_ROLES.OWNER, "Owner A");
		const tenant = await createUser(USER_ROLES.TENANT, "Asha Singh");
		const { leaseId } = await createLeaseFixture({ owner, tenant });

		const startPaymentId = await createPayment(leaseId, {
			paymentDate: new Date("2026-03-31T18:30:00.000Z"),
			paymentMethods: "cash",
			referenceNumber: "CASH-APRIL",
			description: "April rent",
		});

		const reversalId = await createPayment(leaseId, {
			amount: -25_000_00,
			paymentDate: new Date("2026-04-30T18:29:59.999Z"),
			type: PAYMENT_TYPES.REVERSAL,
			paymentMethods: null,
			referenceNumber: startPaymentId,
			reversesPaymentId: startPaymentId,
			description: "Reversed entry",
		});

		await createPayment(leaseId, {
			paymentDate: new Date("2026-04-30T18:30:00.000Z"),
			description: "Outside selected range",
		});

		const result = await clientFor(owner).exportOwnerPayments({
			startDate: "2026-04-01",
			endDate: "2026-04-30",
		});

		expect(result.payments.map(({ id }) => id)).toEqual([
			reversalId,
			startPaymentId,
		]);

		expect(result.payments).toEqual([
			expect.objectContaining({
				id: reversalId,
				amount: -25_000_00,
				type: PAYMENT_TYPES.REVERSAL,
				paymentMethods: null,
				referenceNumber: startPaymentId,
				description: "Reversed entry",
				tenantName: "Asha Singh",
				propertyName: "Palm Residency",
				unitNumber: "A-204",
			}),
			expect.objectContaining({
				id: startPaymentId,
				amount: 25_000_00,
				paymentMethods: "cash",
				referenceNumber: "CASH-APRIL",
				description: "April rent",
			}),
		]);
	});

	it("never returns another owner's payments from a range export", async () => {
		const ownerA = await createUser(USER_ROLES.OWNER, "Owner A");
		const ownerB = await createUser(USER_ROLES.OWNER, "Owner B");
		const tenantA = await createUser(USER_ROLES.TENANT, "Tenant A");
		const tenantB = await createUser(USER_ROLES.TENANT, "Tenant B");
		const leaseA = await createLeaseFixture({ owner: ownerA, tenant: tenantA });
		const leaseB = await createLeaseFixture({ owner: ownerB, tenant: tenantB });

		const paymentA = await createPayment(leaseA.leaseId, {
			paymentDate: new Date("2026-08-01T00:00:00.000Z"),
		});
		const paymentB = await createPayment(leaseB.leaseId, {
			paymentDate: new Date("2026-08-01T00:00:00.000Z"),
		});

		const range = {
			startDate: "2026-08-01",
			endDate: "2026-08-31",
		};

		const ownerAResult = await clientFor(ownerA).exportOwnerPayments(range);
		const ownerBResult = await clientFor(ownerB).exportOwnerPayments(range);

		expect(ownerAResult.payments.map(({ id }) => id)).toEqual([paymentA]);
		expect(ownerBResult.payments.map(({ id }) => id)).toEqual([paymentB]);
	});

	it("returns tenant history across active and historic leases without cross-owner leakage", async () => {
		const owner = await createUser(USER_ROLES.OWNER, "Owner A");
		const otherOwner = await createUser(USER_ROLES.OWNER, "Owner B");
		const tenant = await createUser(USER_ROLES.TENANT, "Tenant A");
		const historicLease = await createLeaseFixture({
			owner,
			tenant,
			propertyName: "Old Residency",
			unitNumber: "OLD-1",
			status: LEASE_STATUSES.EXPIRED,
			endDate: new Date("2025-12-31T00:00:00.000Z"),
		});
		const activeLease = await createLeaseFixture({
			owner,
			tenant,
			propertyName: "New Residency",
			unitNumber: "NEW-2",
		});

		const historicPaymentId = await createPayment(historicLease.leaseId, {
			paymentDate: new Date("2025-06-01T00:00:00.000Z"),
		});
		const activePaymentId = await createPayment(activeLease.leaseId, {
			paymentDate: new Date("2026-06-01T00:00:00.000Z"),
		});

		const result = await clientFor(owner).exportTenantPayments({
			tenantId: tenant.id,
		});
		const unauthorizedResult = await clientFor(otherOwner).exportTenantPayments(
			{ tenantId: tenant.id },
		);

		expect(result.payments.map(({ id }) => id)).toEqual([
			activePaymentId,
			historicPaymentId,
		]);
		expect(result.payments.map(({ propertyName }) => propertyName)).toEqual([
			"New Residency",
			"Old Residency",
		]);
		expect(unauthorizedResult.payments).toEqual([]);
	});

	it("uses payment creation time and ID as deterministic ordering tie-breakers", async () => {
		const owner = await createUser(USER_ROLES.OWNER, "Owner A");
		const tenant = await createUser(USER_ROLES.TENANT, "Tenant A");
		const { leaseId } = await createLeaseFixture({ owner, tenant });
		const paymentDate = new Date("2026-08-01T00:00:00.000Z");

		const olderId = await createPayment(leaseId, {
			paymentDate,
			createdAt: new Date("2026-08-01T01:00:00.000Z"),
		});
		const newerFirstId = await createPayment(leaseId, {
			paymentDate,
			createdAt: new Date("2026-08-01T02:00:00.000Z"),
		});
		const newerSecondId = await createPayment(leaseId, {
			paymentDate,
			createdAt: new Date("2026-08-01T02:00:00.000Z"),
		});

		const result = await clientFor(owner).exportOwnerPayments({
			startDate: "2026-08-01",
			endDate: "2026-08-01",
		});

		expect(result.payments.map(({ id }) => id)).toEqual([
			newerSecondId,
			newerFirstId,
			olderId,
		]);
	});

	it("rejects invalid ranges and non-owner callers", async () => {
		const owner = await createUser(USER_ROLES.OWNER, "Owner A");
		const tenant = await createUser(USER_ROLES.TENANT, "Tenant A");

		await expect(
			clientFor(owner).exportOwnerPayments({
				startDate: "2026-08-02",
				endDate: "2026-08-01",
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		await expect(
			clientFor(owner).exportOwnerPayments({
				startDate: "2026-02-30",
				endDate: "2026-03-01",
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		await expect(
			clientFor(tenant).exportOwnerPayments({
				startDate: "2026-08-01",
				endDate: "2026-08-31",
			}),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("asks the owner to narrow an export containing more than 10,000 rows", async () => {
		const owner = await createUser(USER_ROLES.OWNER, "Owner A");
		const tenant = await createUser(USER_ROLES.TENANT, "Tenant A");
		const { leaseId } = await createLeaseFixture({ owner, tenant });

		const rows = Array.from({ length: 10_001 }, () => ({
			id: generatedId(),
			leaseId,
			amount: 100,
			paymentDate: new Date("2026-08-01T00:00:00.000Z"),
			type: PAYMENT_TYPES.RENT,
		}));

		for (let start = 0; start < rows.length; start += 1_000) {
			await db.insert(payments).values(rows.slice(start, start + 1_000));
		}

		await expect(
			clientFor(owner).exportOwnerPayments({
				startDate: "2026-08-01",
				endDate: "2026-08-01",
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message:
				"This export contains more than 10,000 payments. Narrow the date range and try again.",
		});
	}, 30_000);
});
