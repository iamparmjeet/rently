import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import {
	LEASE_STATUSES,
	PAYMENT_TYPES,
	type PaymentType,
	PROPERTY_TYPES,
	UNIT_STATUSES,
	UNIT_TYPES,
} from "@rently/db/constants/rent-constants";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import { user } from "@rently/db/schema/auth";
import {
	leases,
	ownerProfiles,
	payments,
	properties,
	tenantProfiles,
	units,
} from "@rently/db/schema/schema";
import { generatedId } from "@rently/db/utils/id";
import { eq, inArray } from "drizzle-orm";
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
	getMyPaymentReceiptData,
	getPaymentReceiptData,
} from "../rent/receipt";

const db = createDb();

const createdUserIds: string[] = [];
const createdOwnerProfileIds: string[] = [];
const createdTenantProfileIds: string[] = [];
const createdPropertyIds: string[] = [];
const createdUnitIds: string[] = [];
const createdLeaseIds: string[] = [];
const createdPaymentIds: string[] = [];

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
			getPaymentReceiptData,
			getMyPaymentReceiptData,
		},
		{
			context: {
				db,
				headers: new Headers(),
			},
		},
	);
}

async function createReceiptFixture(type: PaymentType = PAYMENT_TYPES.RENT) {
	const owner = await createUser(USER_ROLES.OWNER, "Owner A");
	const tenant = await createUser(USER_ROLES.TENANT, "Tenant A");

	const ownerProfileId = crypto.randomUUID();
	createdOwnerProfileIds.push(ownerProfileId);

	await db.insert(ownerProfiles).values({
		id: ownerProfileId,
		userId: owner.id,
		companyName: "Owner Properties",
		address: "10 Owner Street, Mumbai",
		gstNumber: "27ABCDE1234F1Z5",
	});

	const tenantProfileId = crypto.randomUUID();
	createdTenantProfileIds.push(tenantProfileId);

	await db.insert(tenantProfiles).values({
		id: tenantProfileId,
		userId: tenant.id,
		address: "12 Tenant Road, Mumbai",
	});

	const propertyId = crypto.randomUUID();
	createdPropertyIds.push(propertyId);

	await db.insert(properties).values({
		id: propertyId,
		ownerId: owner.id,
		name: "Palm Residency",
		address: "1 Palm Road, Mumbai",
		type: PROPERTY_TYPES.RESIDENTIAL,
	});

	const unitId = crypto.randomUUID();
	createdUnitIds.push(unitId);

	await db.insert(units).values({
		id: unitId,
		propertyId,
		unitNumber: "A-204",
		type: UNIT_TYPES.ONEBHK,
		baseRent: 25_000_00,
		status: UNIT_STATUSES.OCCUPIED,
	});

	const leaseId = crypto.randomUUID();
	createdLeaseIds.push(leaseId);

	await db.insert(leases).values({
		id: leaseId,
		unitId,
		tenantId: tenant.id,
		startDate: new Date("2026-01-01T00:00:00.000Z"),
		rent: 25_000_00,
		status: LEASE_STATUSES.ACTIVE,
	});

	const paymentId = generatedId();
	createdPaymentIds.push(paymentId);

	await db.insert(payments).values({
		id: paymentId,
		leaseId,
		amount: 25_000_00,
		paymentDate: new Date("2026-08-01T00:00:00.000Z"),
		type,
		paymentMethods: "upi",
		referenceNumber: "UPI-12345",
		description: "August 2026 rent",
	});

	return { owner, tenant, paymentId };
}

afterEach(async () => {
	if (createdPaymentIds.length > 0) {
		await db.delete(payments).where(inArray(payments.id, createdPaymentIds));
	}
	if (createdLeaseIds.length > 0) {
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
	if (createdTenantProfileIds.length > 0) {
		await db
			.delete(tenantProfiles)
			.where(inArray(tenantProfiles.id, createdTenantProfileIds));
	}
	if (createdOwnerProfileIds.length > 0) {
		await db
			.delete(ownerProfiles)
			.where(inArray(ownerProfiles.id, createdOwnerProfileIds));
	}
	if (createdUserIds.length > 0) {
		await db.delete(user).where(inArray(user.id, createdUserIds));
	}

	createdUserIds.length = 0;
	createdOwnerProfileIds.length = 0;
	createdTenantProfileIds.length = 0;
	createdPropertyIds.length = 0;
	createdUnitIds.length = 0;
	createdLeaseIds.length = 0;
	createdPaymentIds.length = 0;
	mocks.getSession.mockReset();
});

describe("payment receipts", () => {
	it("returns the enriched receipt to the owning landlord", async () => {
		const { owner, paymentId } = await createReceiptFixture();

		const result = await clientFor(owner).getPaymentReceiptData({
			paymentId,
		});

		expect(result.receipt).toMatchObject({
			receiptNumber: expect.stringContaining("KQ-RCPT-"),
			payment: {
				id: paymentId,
				amount: 25_000_00,
				type: PAYMENT_TYPES.RENT,
				paymentMethods: "upi",
				referenceNumber: "UPI-12345",
			},
			property: {
				name: "Palm Residency",
				address: "1 Palm Road, Mumbai",
			},
			unit: {
				unitNumber: "A-204",
			},
			tenant: {
				name: "Tenant A",
				address: "12 Tenant Road, Mumbai",
			},
			owner: {
				name: "Owner A",
				companyName: "Owner Properties",
				address: "10 Owner Street, Mumbai",
				gstNumber: "27ABCDE1234F1Z5",
			},
		});
	});

	it("returns the same receipt to the tenant on the lease", async () => {
		const { owner, tenant, paymentId } = await createReceiptFixture();

		const ownerResult = await clientFor(owner).getPaymentReceiptData({
			paymentId,
		});
		const tenantResult = await clientFor(tenant).getMyPaymentReceiptData({
			paymentId,
		});

		expect(tenantResult.receipt).toEqual(ownerResult.receipt);
	});

	it("does not expose an owner's receipt to another owner", async () => {
		const { paymentId } = await createReceiptFixture();
		const otherOwner = await createUser(USER_ROLES.OWNER, "Owner B");

		await expect(
			clientFor(otherOwner).getPaymentReceiptData({ paymentId }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("does not expose a tenant's receipt to another tenant", async () => {
		const { paymentId } = await createReceiptFixture();
		const otherTenant = await createUser(USER_ROLES.TENANT, "Tenant B");

		await expect(
			clientFor(otherTenant).getMyPaymentReceiptData({ paymentId }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("rejects receipt generation for reversals", async () => {
		const { owner, paymentId } = await createReceiptFixture(
			PAYMENT_TYPES.REVERSAL,
		);

		await expect(
			clientFor(owner).getPaymentReceiptData({ paymentId }),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: "A receipt cannot be generated for a reversal.",
		});
	});

	it("allows a receipt when optional profile rows are absent", async () => {
		const { owner, tenant, paymentId } = await createReceiptFixture();

		await db.delete(ownerProfiles).where(eq(ownerProfiles.userId, owner.id));
		await db.delete(tenantProfiles).where(eq(tenantProfiles.userId, tenant.id));

		const result = await clientFor(owner).getPaymentReceiptData({
			paymentId,
		});

		expect(result.receipt.owner).toMatchObject({
			name: "Owner A",
			companyName: null,
			address: null,
			gstNumber: null,
		});
		expect(result.receipt.tenant).toEqual({
			name: "Tenant A",
			address: null,
		});
	});
});
