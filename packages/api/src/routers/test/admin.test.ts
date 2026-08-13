import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import {
	ADMIN_AUDIT_ACTIONS,
	ADMIN_TARGET_TYPES,
} from "@rently/db/constants/admin-constants";
import {
	BILLING_INTERVAL,
	PAYMENT_METHODS,
	PAYMENT_STATUS,
	PLAN_STATUS,
} from "@rently/db/constants/payment-constants";
import { USER_ROLES, type UserRole } from "@rently/db/constants/user-roles";
import { adminAuditLogs } from "@rently/db/schema/admin";
import { account, session, user } from "@rently/db/schema/auth";
import {
	betaAccessCodes,
	invoices,
	plans,
	subscriptions,
} from "@rently/db/schema/subscription";
import { generatedId } from "@rently/db/utils/id";
import { and, eq, inArray } from "drizzle-orm";
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
	createAdminBetaCode,
	expireAdminBetaCode,
} from "../../modules/admin/beta-codes";
import { queryAdminOverview } from "../../modules/admin/overview";
import { recordSubscriptionPayment } from "../../modules/admin/subscriptions";
import {
	queryAdminUserDetail,
	queryAdminUsers,
} from "../../modules/admin/users";
import { getOverview } from "../admin/stats";

const db = createDb();

const createdUserIds: string[] = [];
const createdPlanIds: string[] = [];
const createdSubscriptionIds: string[] = [];
const createdBetaCodeIds: string[] = [];

type TestUser = {
	id: string;
	name: string;
	email: string;
	role: UserRole;
};

async function createUser(
	role: UserRole,
	name: string,
	options: { emailVerified?: boolean; createdAt?: Date } = {},
): Promise<TestUser> {
	const id = generatedId();
	const email = `${id}@admin-test.keyhq.invalid`;
	createdUserIds.push(id);

	await db.insert(user).values({
		id,
		name,
		email,
		role,
		emailVerified: options.emailVerified ?? false,
		createdAt: options.createdAt,
	});

	return { id, name, email, role };
}

async function createPlan(name = "Admin Test Pro") {
	const id = generatedId();
	const slug = `admin-test-${id}`;
	createdPlanIds.push(id);

	const [plan] = await db
		.insert(plans)
		.values({
			id,
			name,
			slug,
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

async function createSubscription(ownerId: string, planId: string) {
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
			currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
			currentPeriodEnd: new Date("2026-08-31T00:00:00.000Z"),
			totalPaid: 0,
		})
		.returning();

	if (!subscription) throw new Error("Test subscription was not created");
	return subscription;
}

function clientFor(authUser: TestUser | null) {
	mocks.getSession.mockResolvedValue(
		authUser ? { user: authUser, session: { id: "admin-test-session" } } : null,
	);

	return createRouterClient(
		{ getOverview },
		{ context: { db, headers: new Headers() } },
	);
}

afterEach(async () => {
	if (createdBetaCodeIds.length > 0) {
		await db
			.delete(adminAuditLogs)
			.where(
				and(
					eq(adminAuditLogs.targetType, ADMIN_TARGET_TYPES.BETA_CODE),
					inArray(adminAuditLogs.targetId, createdBetaCodeIds),
				),
			);
		await db
			.delete(betaAccessCodes)
			.where(inArray(betaAccessCodes.id, createdBetaCodeIds));
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

	if (createdUserIds.length > 0) {
		await db.delete(session).where(inArray(session.userId, createdUserIds));
		await db.delete(account).where(inArray(account.userId, createdUserIds));
		await db.delete(user).where(inArray(user.id, createdUserIds));
	}

	if (createdPlanIds.length > 0) {
		await db.delete(plans).where(inArray(plans.id, createdPlanIds));
	}

	createdBetaCodeIds.length = 0;
	createdSubscriptionIds.length = 0;
	createdUserIds.length = 0;
	createdPlanIds.length = 0;
	mocks.getSession.mockReset();
});

describe("admin access", () => {
	it("rejects unauthenticated, owner, and tenant sessions", async () => {
		await expect(clientFor(null).getOverview()).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});

		for (const role of [USER_ROLES.OWNER, USER_ROLES.TENANT] as const) {
			const nonAdmin = await createUser(role, `Not admin ${role}`);
			await expect(clientFor(nonAdmin).getOverview()).rejects.toMatchObject({
				code: "FORBIDDEN",
			});
		}
	});

	it("allows an authenticated admin session", async () => {
		const admin = await createUser(USER_ROLES.ADMIN, "Admin User");
		const result = await clientFor(admin).getOverview();

		expect(result.users.admins).toBeGreaterThanOrEqual(1);
		expect(result.revenue).toHaveProperty("platformRevenueLifetime");
	});
});

describe("admin user support queries", () => {
	it("applies deterministic search, role, verification, and pagination filters", async () => {
		const createdAt = new Date("2026-08-10T08:00:00.000Z");
		const owner = await createUser(USER_ROLES.OWNER, "Unique Support Owner", {
			emailVerified: true,
			createdAt,
		});
		const plan = await createPlan();
		await createSubscription(owner.id, plan.id);

		const firstPage = await queryAdminUsers(db, {
			page: 1,
			pageSize: 1,
			search: "Unique Support",
			role: USER_ROLES.OWNER,
			emailVerified: true,
			planSlug: plan.slug ?? undefined,
			subscriptionStatus: PLAN_STATUS.TRIAL,
			createdFrom: new Date("2026-08-10T00:00:00.000Z"),
			createdTo: new Date("2026-08-11T00:00:00.000Z"),
		});
		const repeatedPage = await queryAdminUsers(db, {
			page: 1,
			pageSize: 1,
			search: "Unique Support",
			role: USER_ROLES.OWNER,
			emailVerified: true,
			planSlug: plan.slug ?? undefined,
			subscriptionStatus: PLAN_STATUS.TRIAL,
			createdFrom: new Date("2026-08-10T00:00:00.000Z"),
			createdTo: new Date("2026-08-11T00:00:00.000Z"),
		});

		expect(firstPage).toEqual(repeatedPage);
		expect(firstPage).toMatchObject({ total: 1, totalPages: 1 });
		expect(firstPage.items[0]).toMatchObject({
			id: owner.id,
			role: USER_ROLES.OWNER,
			emailVerified: true,
			subscription: { planId: plan.id, status: PLAN_STATUS.TRIAL },
		});
	});

	it("returns only redacted support fields even when secrets exist", async () => {
		const owner = await createUser(USER_ROLES.OWNER, "Secret-bearing Owner");
		const plan = await createPlan();
		await createSubscription(owner.id, plan.id);

		await db.insert(account).values({
			id: generatedId(),
			accountId: owner.id,
			providerId: "credential",
			userId: owner.id,
			password: "must-never-leave-the-server",
			accessToken: "private-access-token",
		});
		await db.insert(session).values({
			id: generatedId(),
			userId: owner.id,
			token: `secret-session-${owner.id}`,
			expiresAt: new Date("2027-01-01T00:00:00.000Z"),
		});

		const detail = await queryAdminUserDetail(db, owner.id);
		const serialized = JSON.stringify(detail);

		expect(serialized).not.toContain("must-never-leave-the-server");
		expect(serialized).not.toContain("private-access-token");
		expect(serialized).not.toContain(`secret-session-${owner.id}`);
		expect(detail.user).toMatchObject({ id: owner.id, email: owner.email });
		expect(detail.ownerSummary).toEqual({
			propertyCount: 0,
			unitCount: 0,
			tenantCount: 0,
			activeLeaseCount: 0,
		});
	});
});

describe("truthful subscription payment workflow", () => {
	it("uses only each owner's latest subscription in overview counts", async () => {
		const before = await queryAdminOverview(db);
		const owner = await createUser(USER_ROLES.OWNER, "Plan History Owner");
		const oldPlan = await createPlan("Historic Plan");
		const currentPlan = await createPlan("Current Plan");
		const historic = await createSubscription(owner.id, oldPlan.id);
		const current = await createSubscription(owner.id, currentPlan.id);

		await db
			.update(subscriptions)
			.set({ createdAt: new Date("2026-01-01T00:00:00.000Z") })
			.where(eq(subscriptions.id, historic.id));
		await db
			.update(subscriptions)
			.set({
				status: PLAN_STATUS.ACTIVE,
				createdAt: new Date("2026-08-01T00:00:00.000Z"),
			})
			.where(eq(subscriptions.id, current.id));

		const after = await queryAdminOverview(db);
		const beforePlanCount = (planId: string) =>
			before.planDistribution.find((item) => item.planId === planId)?.count ??
			0;
		const afterPlanCount = (planId: string) =>
			after.planDistribution.find((item) => item.planId === planId)?.count ?? 0;

		expect(afterPlanCount(oldPlan.id) - beforePlanCount(oldPlan.id)).toBe(0);
		expect(
			afterPlanCount(currentPlan.id) - beforePlanCount(currentPlan.id),
		).toBe(1);
		expect(after.subscriptions.active - before.subscriptions.active).toBe(1);
		expect(after.subscriptions.trial - before.subscriptions.trial).toBe(0);
	});

	it("counts only paid invoices as platform revenue", async () => {
		const owner = await createUser(USER_ROLES.OWNER, "Revenue Owner");
		const plan = await createPlan();
		const subscription = await createSubscription(owner.id, plan.id);
		const before = await queryAdminOverview(db);
		const now = new Date();
		const periodEnd = new Date(now);
		periodEnd.setMonth(periodEnd.getMonth() + 1);

		await db.insert(invoices).values([
			{
				id: generatedId(),
				subscriptionId: subscription.id,
				userId: owner.id,
				amount: 11_100,
				periodStart: now,
				periodEnd,
				paymentStatus: PAYMENT_STATUS.PAID,
				paidAt: now,
			},
			{
				id: generatedId(),
				subscriptionId: subscription.id,
				userId: owner.id,
				amount: 22_200,
				periodStart: now,
				periodEnd,
				paymentStatus: PAYMENT_STATUS.UNPAID,
			},
			{
				id: generatedId(),
				subscriptionId: subscription.id,
				userId: owner.id,
				amount: 33_300,
				periodStart: now,
				periodEnd,
				paymentStatus: PAYMENT_STATUS.FAILED,
			},
		]);

		const after = await queryAdminOverview(db);
		expect(
			after.revenue.platformRevenueLifetime -
				before.revenue.platformRevenueLifetime,
		).toBe(11_100);
		expect(
			after.revenue.platformRevenueLast30Days -
				before.revenue.platformRevenueLast30Days,
		).toBe(11_100);
		expect(after.revenue).toHaveProperty("managedRentVolumeLifetime");
	});

	it("atomically records one concurrent reference and extends access once", async () => {
		const admin = await createUser(USER_ROLES.ADMIN, "Payment Admin");
		const owner = await createUser(USER_ROLES.OWNER, "Paying Owner");
		const plan = await createPlan();
		const subscription = await createSubscription(owner.id, plan.id);
		const externalPaymentReference = `UTR${Date.now()}${crypto.randomUUID().slice(0, 8)}`;
		const input = {
			ownerUserId: owner.id,
			planId: plan.id,
			billingInterval: BILLING_INTERVAL.MONTHLY,
			amount: plan.priceMonthly,
			paymentMethod: PAYMENT_METHODS.UPI,
			externalPaymentReference,
			paidAt: new Date("2026-08-13T08:00:00.000Z"),
			reason: "UPI matched against the test bank statement",
		};

		const results = await Promise.allSettled([
			recordSubscriptionPayment(db, admin.id, input),
			recordSubscriptionPayment(db, admin.id, input),
		]);
		expect(
			results.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		expect(
			results.filter((result) => result.status === "rejected"),
		).toHaveLength(1);

		const [updated] = await db
			.select()
			.from(subscriptions)
			.where(eq(subscriptions.id, subscription.id));
		const invoiceRows = await db
			.select()
			.from(invoices)
			.where(eq(invoices.externalPaymentReference, externalPaymentReference));
		const auditRows = await db
			.select()
			.from(adminAuditLogs)
			.where(
				and(
					eq(
						adminAuditLogs.action,
						ADMIN_AUDIT_ACTIONS.SUBSCRIPTION_PAYMENT_RECORDED,
					),
					eq(adminAuditLogs.targetId, subscription.id),
				),
			);

		expect(updated?.status).toBe(PLAN_STATUS.ACTIVE);
		expect(updated?.totalPaid).toBe(plan.priceMonthly);
		expect(invoiceRows).toHaveLength(1);
		expect(invoiceRows[0]).toMatchObject({
			paymentStatus: PAYMENT_STATUS.PAID,
			recordedByAdminUserId: admin.id,
		});
		expect(auditRows).toHaveLength(1);
		expect(auditRows[0]?.reason).toBe(input.reason);
	});

	it("rolls back subscription changes when a later operation fails", async () => {
		const owner = await createUser(USER_ROLES.OWNER, "Rollback Owner");
		const plan = await createPlan();
		const subscription = await createSubscription(owner.id, plan.id);
		const reference = `ROLLBACK${crypto.randomUUID().replaceAll("-", "")}`;

		await expect(
			recordSubscriptionPayment(db, generatedId(), {
				ownerUserId: owner.id,
				planId: plan.id,
				billingInterval: BILLING_INTERVAL.MONTHLY,
				amount: plan.priceMonthly,
				paymentMethod: PAYMENT_METHODS.UPI,
				externalPaymentReference: reference,
				paidAt: new Date("2026-08-13T08:00:00.000Z"),
				reason: "Force a foreign-key failure to prove rollback",
			}),
		).rejects.toBeDefined();

		const [unchanged] = await db
			.select()
			.from(subscriptions)
			.where(eq(subscriptions.id, subscription.id));
		const invoiceRows = await db
			.select()
			.from(invoices)
			.where(eq(invoices.externalPaymentReference, reference));

		expect(unchanged).toMatchObject({
			status: PLAN_STATUS.TRIAL,
			totalPaid: 0,
		});
		expect(invoiceRows).toHaveLength(0);
	});
});

describe("audited beta-code management", () => {
	it("creates and expires a code once under concurrent requests", async () => {
		const admin = await createUser(USER_ROLES.ADMIN, "Beta Admin");
		const plan = await createPlan();
		const created = await createAdminBetaCode(db, admin.id, {
			grantsPlanSlug: plan.slug ?? "",
			periodDays: 90,
			maxUses: 1,
			expiresAt: null,
			reason: "Approved founder beta onboarding campaign",
		});
		createdBetaCodeIds.push(created.betaCode.id);

		const expireInput = {
			betaCodeId: created.betaCode.id,
			reason: "Founder ended this beta campaign early",
		};
		const results = await Promise.allSettled([
			expireAdminBetaCode(db, admin.id, expireInput),
			expireAdminBetaCode(db, admin.id, expireInput),
		]);

		expect(
			results.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		expect(
			results.filter((result) => result.status === "rejected"),
		).toHaveLength(1);

		const auditRows = await db
			.select()
			.from(adminAuditLogs)
			.where(eq(adminAuditLogs.targetId, created.betaCode.id));
		const [storedCode] = await db
			.select()
			.from(betaAccessCodes)
			.where(eq(betaAccessCodes.id, created.betaCode.id));

		expect(storedCode?.expiresAt).toBeInstanceOf(Date);
		expect(auditRows.map((row) => row.action).sort()).toEqual(
			[
				ADMIN_AUDIT_ACTIONS.BETA_CODE_CREATED,
				ADMIN_AUDIT_ACTIONS.BETA_CODE_EXPIRED,
			].sort(),
		);
		expect(auditRows.every((row) => row.reason.length >= 8)).toBe(true);
	});
});
