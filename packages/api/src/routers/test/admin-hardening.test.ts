// Admin-console hardening regressions (feat/admin-hardening). Per the
// AGENTS.md test rule, each case pins a concrete regression the slice fixes:
// - month-end renewal: JS setUTCMonth overflowed Jan 31 + 1 month to Mar 3,
//   granting phantom days and shifting the billing anchor — SQL make_interval
//   must clamp to Feb 28;
// - concurrent payments with different references: both read the same period
//   end and lost one extension — the per-owner advisory lock must serialize
//   them so the extensions chain and each invoice covers its own window;
// - demo/sample identities: the overview hid them but the support lists and
//   the payment mutation did not — a demo owner must not be listed or paid;
// - multi-use beta codes: used_by_user_id/used_at stay null, so the admin
//   history read must use the redemption ledger or it shows nothing;
// - exhausting a beta code: the UI disabled it but the API allowed stamping
//   an expiry on an exhausted code — the server must refuse.
import { createDb } from "@rently/db";
import { ADMIN_TARGET_TYPES } from "@rently/db/constants/admin-constants";
import {
	BILLING_INTERVAL,
	PAYMENT_METHODS,
	PAYMENT_STATUS,
	PLAN_STATUS,
} from "@rently/db/constants/payment-constants";
import {
	LEASE_STATUSES,
	PAYMENT_TYPES,
	PROPERTY_TYPES,
	UNIT_STATUSES,
	UNIT_TYPES,
} from "@rently/db/constants/rent-constants";
import { USER_ROLES, type UserRole } from "@rently/db/constants/user-roles";
import { ACCOUNT_MODES } from "@rently/db/constants/workspace-modes";
import { adminAuditLogs } from "@rently/db/schema/admin";
import { user } from "@rently/db/schema/auth";
import { leases, payments, properties, units } from "@rently/db/schema/schema";
import {
	betaAccessCodes,
	betaCodeRedemptions,
	invoices,
	plans,
	subscriptions,
} from "@rently/db/schema/subscription";
import { generatedId } from "@rently/db/utils/id";
import { and, eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import {
	createAdminBetaCode,
	expireAdminBetaCode,
	queryAdminBetaCodeRedemptions,
} from "../../modules/admin/beta-codes";
import { queryAdminOverview } from "../../modules/admin/overview";
import {
	queryAdminOutstandingInvoices,
	queryAdminSubscriptions,
	recordSubscriptionPayment,
} from "../../modules/admin/subscriptions";
import {
	queryAdminUserDetail,
	queryAdminUsers,
} from "../../modules/admin/users";

const db = createDb();

const createdUserIds: string[] = [];
const createdPlanIds: string[] = [];
const createdSubscriptionIds: string[] = [];
const createdCodeIds: string[] = [];
const createdPropertyIds: string[] = [];
const createdUnitIds: string[] = [];
const createdLeaseIds: string[] = [];
const createdPaymentIds: string[] = [];

async function createUser(
	role: UserRole,
	name: string,
	accountMode: string = ACCOUNT_MODES.STANDARD,
) {
	const id = generatedId();
	createdUserIds.push(id);
	await db.insert(user).values({
		id,
		name,
		email: `${id}@admin-hardening.keyhq.invalid`,
		role,
		accountMode,
	});
	return { id, name, email: `${id}@admin-hardening.keyhq.invalid` };
}

async function createPlan() {
	const id = generatedId();
	createdPlanIds.push(id);
	const [plan] = await db
		.insert(plans)
		.values({
			id,
			name: "Hardening Plan",
			slug: `hardening-${id}`,
			priceMonthly: 49_900,
			priceQuarterly: 142_200,
			priceHalfYearly: 269_400,
			priceYearly: 508_800,
			priceTwoYear: 958_000,
		})
		.returning();
	if (!plan) throw new Error("Test plan was not created");
	return plan;
}

async function createSubscription(
	ownerId: string,
	planId: string,
	period: { start: Date | null; end: Date | null },
) {
	const id = generatedId();
	createdSubscriptionIds.push(id);
	const [subscription] = await db
		.insert(subscriptions)
		.values({
			id,
			userId: ownerId,
			planId,
			status: PLAN_STATUS.TRIAL,
			billingInterval: BILLING_INTERVAL.MONTHLY,
			currentPeriodStart: period.start,
			currentPeriodEnd: period.end,
			totalPaid: 0,
		})
		.returning();
	if (!subscription) throw new Error("Test subscription was not created");
	return subscription;
}

// Minimal property → unit → lease → rent payment chain, enough for the
// managed-rent-volume aggregate to see one landlord's activity.
async function seedRentPayment(ownerId: string, amount: number) {
	const propertyId = generatedId();
	const unitId = generatedId();
	const leaseId = generatedId();
	const paymentId = generatedId();
	createdPropertyIds.push(propertyId);
	createdUnitIds.push(unitId);
	createdLeaseIds.push(leaseId);
	createdPaymentIds.push(paymentId);

	await db.insert(properties).values({
		id: propertyId,
		ownerId,
		name: "Hardening Property",
		address: "1 Test Street",
		type: PROPERTY_TYPES.RESIDENTIAL,
	});
	await db.insert(units).values({
		id: unitId,
		propertyId,
		unitNumber: `U-${unitId.slice(0, 8)}`,
		type: UNIT_TYPES.ONEBHK,
		baseRent: 100_000,
		status: UNIT_STATUSES.OCCUPIED,
	});
	await db.insert(leases).values({
		id: leaseId,
		unitId,
		tenantId: ownerId,
		startDate: new Date("2026-01-01T00:00:00.000Z"),
		rent: 100_000,
		status: LEASE_STATUSES.ACTIVE,
	});
	await db.insert(payments).values({
		id: paymentId,
		leaseId,
		amount,
		paymentDate: new Date("2026-08-15T00:00:00.000Z"),
		type: PAYMENT_TYPES.RENT,
	});
}

function paymentInput(
	ownerUserId: string,
	planId: string,
	priceMonthly: number,
	overrides: Partial<Parameters<typeof recordSubscriptionPayment>[2]> = {},
) {
	return {
		ownerUserId,
		planId,
		billingInterval: BILLING_INTERVAL.MONTHLY,
		amount: priceMonthly,
		paymentMethod: PAYMENT_METHODS.UPI,
		externalPaymentReference: `UTR${crypto.randomUUID().slice(0, 12)}`,
		paidAt: new Date("2026-08-05T08:00:00.000Z"),
		reason: "Admin hardening regression",
		...overrides,
	};
}

afterEach(async () => {
	if (createdCodeIds.length > 0) {
		await db
			.delete(adminAuditLogs)
			.where(
				and(
					eq(adminAuditLogs.targetType, ADMIN_TARGET_TYPES.BETA_CODE),
					inArray(adminAuditLogs.targetId, createdCodeIds),
				),
			);
		await db
			.delete(betaCodeRedemptions)
			.where(inArray(betaCodeRedemptions.codeId, createdCodeIds));
		await db
			.delete(betaAccessCodes)
			.where(inArray(betaAccessCodes.id, createdCodeIds));
	}
	if (createdSubscriptionIds.length > 0) {
		await db
			.delete(adminAuditLogs)
			.where(
				and(
					eq(adminAuditLogs.targetType, ADMIN_TARGET_TYPES.SUBSCRIPTION),
					inArray(adminAuditLogs.targetId, createdSubscriptionIds),
				),
			);
		await db
			.delete(invoices)
			.where(inArray(invoices.subscriptionId, createdSubscriptionIds));
		await db
			.delete(subscriptions)
			.where(inArray(subscriptions.id, createdSubscriptionIds));
	}
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
	if (createdUserIds.length > 0) {
		await db.delete(invoices).where(inArray(invoices.userId, createdUserIds));
		await db.delete(user).where(inArray(user.id, createdUserIds));
	}
	if (createdPlanIds.length > 0) {
		await db.delete(plans).where(inArray(plans.id, createdPlanIds));
	}
	createdUserIds.length = 0;
	createdPlanIds.length = 0;
	createdSubscriptionIds.length = 0;
	createdCodeIds.length = 0;
	createdPropertyIds.length = 0;
	createdUnitIds.length = 0;
	createdLeaseIds.length = 0;
	createdPaymentIds.length = 0;
});

describe("managed rent volume demo exclusion", () => {
	it("counts a standard owner's rent but not a demo identity's seeded portfolio", async () => {
		const before = await queryAdminOverview(db);
		const demoOwner = await createUser(
			USER_ROLES.OWNER,
			"Demo Rent Owner",
			ACCOUNT_MODES.PUBLIC_DEMO,
		);
		const standardOwner = await createUser(USER_ROLES.OWNER, "Real Rent Owner");
		await seedRentPayment(demoOwner.id, 500_000);
		await seedRentPayment(standardOwner.id, 700_000);

		const after = await queryAdminOverview(db);

		// The demo owner's activity is excluded — without the accountMode leg
		// the delta would be 1_200_000 and the headline would contradict the
		// zeroed owner/tenant/revenue cards.
		expect(
			after.revenue.managedRentVolumeLifetime -
				before.revenue.managedRentVolumeLifetime,
		).toBe(700_000);
	});
});

describe("subscription payment period math", () => {
	it("clamps a month-end renewal instead of overflowing into the next month", async () => {
		const admin = await createUser(USER_ROLES.ADMIN, "Clamp Admin");
		const owner = await createUser(USER_ROLES.OWNER, "Clamp Owner");
		const plan = await createPlan();
		await createSubscription(owner.id, plan.id, {
			start: new Date("2026-01-01T00:00:00.000Z"),
			end: new Date("2026-01-31T00:00:00.000Z"),
		});

		const { invoice } = await recordSubscriptionPayment(
			db,
			admin.id,
			paymentInput(owner.id, plan.id, plan.priceMonthly, {
				paidAt: new Date("2026-01-15T08:00:00.000Z"),
			}),
		);

		expect(invoice.periodStart).toEqual(new Date("2026-01-31T00:00:00.000Z"));
		// Feb 2026 has 28 days: the extension is Feb 28, never Mar 3.
		expect(invoice.periodEnd).toEqual(new Date("2026-02-28T00:00:00.000Z"));
	});

	it("chains two concurrent different-reference payments without losing an extension", async () => {
		const admin = await createUser(USER_ROLES.ADMIN, "Concurrent Admin");
		const owner = await createUser(USER_ROLES.OWNER, "Concurrent Owner");
		const plan = await createPlan();
		const subscription = await createSubscription(owner.id, plan.id, {
			start: new Date("2026-08-10T00:00:00.000Z"),
			end: new Date("2026-09-10T00:00:00.000Z"),
		});

		const results = await Promise.allSettled([
			recordSubscriptionPayment(
				db,
				admin.id,
				paymentInput(owner.id, plan.id, plan.priceMonthly, {
					paidAt: new Date("2026-09-05T08:00:00.000Z"),
				}),
			),
			recordSubscriptionPayment(
				db,
				admin.id,
				paymentInput(owner.id, plan.id, plan.priceMonthly, {
					paidAt: new Date("2026-09-05T12:00:00.000Z"),
				}),
			),
		]);

		const fulfilled = results
			.filter((result) => result.status === "fulfilled")
			.map((result) => result.value);
		expect(fulfilled).toHaveLength(2);

		const ordered = fulfilled
			.slice()
			.sort(
				(a, b) =>
					a.invoice.periodStart.getTime() - b.invoice.periodStart.getTime(),
			);
		// First grant: [09-10, 10-10]. Second grant must begin exactly where the
		// first ended — no overlap, no shared window, no lost month.
		expect(ordered[0]?.invoice.periodStart).toEqual(
			new Date("2026-09-10T00:00:00.000Z"),
		);
		expect(ordered[0]?.invoice.periodEnd).toEqual(
			new Date("2026-10-10T00:00:00.000Z"),
		);
		expect(ordered[1]?.invoice.periodStart).toEqual(
			new Date("2026-10-10T00:00:00.000Z"),
		);
		expect(ordered[1]?.invoice.periodEnd).toEqual(
			new Date("2026-11-10T00:00:00.000Z"),
		);

		const [updated] = await db
			.select()
			.from(subscriptions)
			.where(eq(subscriptions.id, subscription.id));
		expect(updated?.totalPaid).toBe(plan.priceMonthly * 2);
		expect(updated?.currentPeriodEnd).toEqual(
			new Date("2026-11-10T00:00:00.000Z"),
		);
	});
});

describe("demo and sample identity isolation", () => {
	it("hides demo owners from support lists and refuses their payments", async () => {
		const admin = await createUser(USER_ROLES.ADMIN, "Isolation Admin");
		const demoOwner = await createUser(
			USER_ROLES.OWNER,
			"Demo Owner",
			ACCOUNT_MODES.PUBLIC_DEMO,
		);
		const plan = await createPlan();
		await createSubscription(demoOwner.id, plan.id, {
			start: new Date("2026-08-01T00:00:00.000Z"),
			end: new Date("2026-08-31T00:00:00.000Z"),
		});

		const users = await queryAdminUsers(db, {
			page: 1,
			pageSize: 50,
			search: demoOwner.email,
		});
		expect(
			users.items.find((item) => item.id === demoOwner.id),
		).toBeUndefined();

		const subs = await queryAdminSubscriptions(db, {
			page: 1,
			pageSize: 50,
			search: demoOwner.email,
		});
		expect(
			subs.items.find((item) => item.ownerId === demoOwner.id),
		).toBeUndefined();

		await expect(
			recordSubscriptionPayment(
				db,
				admin.id,
				paymentInput(demoOwner.id, plan.id, plan.priceMonthly),
			),
		).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

		const invoiceRows = await db
			.select({ id: invoices.id })
			.from(invoices)
			.where(eq(invoices.userId, demoOwner.id));
		expect(invoiceRows).toHaveLength(0);
	});
});

describe("outstanding invoice visibility", () => {
	it("lists only unpaid or failed invoices for standard owners", async () => {
		const standardOwner = await createUser(USER_ROLES.OWNER, "Invoice Owner");
		const demoOwner = await createUser(
			USER_ROLES.OWNER,
			"Demo Invoice Owner",
			ACCOUNT_MODES.PUBLIC_DEMO,
		);
		const plan = await createPlan();
		const standardSubscription = await createSubscription(
			standardOwner.id,
			plan.id,
			{
				start: null,
				end: null,
			},
		);
		const demoSubscription = await createSubscription(demoOwner.id, plan.id, {
			start: null,
			end: null,
		});
		const periodStart = new Date("2026-09-01T00:00:00.000Z");
		const periodEnd = new Date("2026-10-01T00:00:00.000Z");

		await db.insert(invoices).values([
			{
				id: generatedId(),
				subscriptionId: standardSubscription.id,
				userId: standardOwner.id,
				amount: 49_900,
				periodStart,
				periodEnd,
				paymentStatus: PAYMENT_STATUS.UNPAID,
			},
			{
				id: generatedId(),
				subscriptionId: standardSubscription.id,
				userId: standardOwner.id,
				amount: 49_900,
				periodStart,
				periodEnd,
				paymentStatus: PAYMENT_STATUS.FAILED,
			},
			{
				id: generatedId(),
				subscriptionId: standardSubscription.id,
				userId: standardOwner.id,
				amount: 49_900,
				periodStart,
				periodEnd,
				paymentStatus: PAYMENT_STATUS.PAID,
			},
			{
				id: generatedId(),
				subscriptionId: demoSubscription.id,
				userId: demoOwner.id,
				amount: 49_900,
				periodStart,
				periodEnd,
				paymentStatus: PAYMENT_STATUS.UNPAID,
			},
		]);

		const result = await queryAdminOutstandingInvoices(db, {
			page: 1,
			pageSize: 25,
		});

		expect(result).toMatchObject({ total: 2, totalPages: 1 });
		expect(result.items).toHaveLength(2);
		expect(
			result.items.every((item) => item.ownerId === standardOwner.id),
		).toBe(true);
		expect(result.items.map((item) => item.paymentStatus).sort()).toEqual([
			PAYMENT_STATUS.FAILED,
			PAYMENT_STATUS.UNPAID,
		]);
	});
});

describe("beta-code redemption visibility and expiry guard", () => {
	it("reads a shared-code redemption from the ledger, not the single-use columns", async () => {
		const admin = await createUser(USER_ROLES.ADMIN, "Ledger Admin");
		const owner = await createUser(USER_ROLES.OWNER, "Ledger Owner");
		const plan = await createPlan();
		const created = await createAdminBetaCode(db, admin.id, {
			grantsPlanSlug: plan.slug ?? "",
			periodDays: 30,
			maxUses: 3,
			expiresAt: null,
			reason: "Shared campaign regression",
		});
		createdCodeIds.push(created.betaCode.id);

		await db.insert(betaCodeRedemptions).values({
			id: generatedId(),
			codeId: created.betaCode.id,
			userId: owner.id,
		});

		const detail = await queryAdminUserDetail(db, owner.id);
		expect(detail.betaCodes).toHaveLength(1);
		expect(detail.betaCodes[0]).toMatchObject({
			codeId: created.betaCode.id,
			code: created.betaCode.code,
			planName: plan.name,
		});

		const redemptions = await queryAdminBetaCodeRedemptions(db, {
			betaCodeId: created.betaCode.id,
			page: 1,
			pageSize: 25,
		});
		expect(redemptions.items).toHaveLength(1);
		expect(redemptions.items[0]).toMatchObject({
			userId: owner.id,
			userName: owner.name,
			userEmail: owner.email,
		});
	});

	it("refuses to expire an exhausted code", async () => {
		const admin = await createUser(USER_ROLES.ADMIN, "Exhausted Admin");
		const owner = await createUser(USER_ROLES.OWNER, "Exhausted Owner");
		const plan = await createPlan();
		const created = await createAdminBetaCode(db, admin.id, {
			grantsPlanSlug: plan.slug ?? "",
			periodDays: 30,
			maxUses: 1,
			expiresAt: null,
			reason: "Single-use expiry regression",
		});
		createdCodeIds.push(created.betaCode.id);

		await db
			.update(betaAccessCodes)
			.set({ totalUses: 1, usedByUserId: owner.id, usedAt: new Date() })
			.where(eq(betaAccessCodes.id, created.betaCode.id));

		await expect(
			expireAdminBetaCode(db, admin.id, {
				betaCodeId: created.betaCode.id,
				reason: "Attempt to expire an exhausted code",
			}),
		).rejects.toMatchObject({ code: "CONFLICT" });

		const [unchanged] = await db
			.select()
			.from(betaAccessCodes)
			.where(eq(betaAccessCodes.id, created.betaCode.id));
		expect(unchanged?.expiresAt).toBeNull();
	});
});
