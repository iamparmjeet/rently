import { createDb } from "@rently/db";
import {
	ADMIN_AUDIT_ACTIONS,
	ADMIN_TARGET_TYPES,
} from "@rently/db/constants/admin-constants";
import { PLAN_STATUS } from "@rently/db/constants/payment-constants";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import { ACCOUNT_MODES } from "@rently/db/constants/workspace-modes";
import { adminAuditLogs } from "@rently/db/schema/admin";
import { user } from "@rently/db/schema/auth";
import { plans, subscriptions } from "@rently/db/schema/subscription";
import { and, eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

// Regression rationale (subscription cancel-at-period-end):
// Before this slice the only subscription mutation was recording a payment;
// there was no way to stop a subscription, and entitlement ignored status
// entirely, so a cancelled subscription would have kept full access forever.
// These tests pin the approved policy:
//   - cancellation flips status but keeps `current_period_end`, so access
//     survives to the end of the paid period (entitlement is time-based),
//   - the effective date and prior status are recorded in the admin audit
//     trail, and a repeat cancel writes no second audit row,
//   - a lapsed period, a missing period end, demo/sample identities, and
//     non-owner targets are refused without touching state.

import { cancelSubscription } from "../../modules/admin/subscriptions";
import { getOwnerEntitlement } from "../helpers/tenant-limit";

const db = createDb();

const createdUserIds: string[] = [];
const createdPlanIds: string[] = [];
const createdSubscriptionIds: string[] = [];

async function createUser(
	role: (typeof USER_ROLES)[keyof typeof USER_ROLES],
	accountMode: string = ACCOUNT_MODES.STANDARD,
) {
	const id = crypto.randomUUID();
	createdUserIds.push(id);
	await db.insert(user).values({
		id,
		name: "Cancellation User",
		email: `${id}@cancellation.keyhq.invalid`,
		role,
		accountMode,
	});
	return id;
}

async function createPlan() {
	const id = crypto.randomUUID();
	createdPlanIds.push(id);
	await db.insert(plans).values({
		id,
		name: "Cancellation Plan",
		slug: `cancellation-${id}`,
		tenantLimit: 5,
		priceMonthly: 49_900,
	});
	return id;
}

async function createSubscription(
	ownerId: string,
	planId: string,
	overrides: {
		status?: (typeof PLAN_STATUS)[keyof typeof PLAN_STATUS];
		currentPeriodEnd?: Date | null;
	} = {},
) {
	const id = crypto.randomUUID();
	createdSubscriptionIds.push(id);
	await db.insert(subscriptions).values({
		id,
		userId: ownerId,
		planId,
		status: overrides.status ?? PLAN_STATUS.ACTIVE,
		currentPeriodEnd:
			overrides.currentPeriodEnd === undefined
				? new Date("2035-01-01T00:00:00.000Z")
				: overrides.currentPeriodEnd,
	});
	return id;
}

async function auditRowsFor(subscriptionId: string) {
	return db
		.select()
		.from(adminAuditLogs)
		.where(
			and(
				eq(adminAuditLogs.targetType, ADMIN_TARGET_TYPES.SUBSCRIPTION),
				eq(adminAuditLogs.targetId, subscriptionId),
				eq(adminAuditLogs.action, ADMIN_AUDIT_ACTIONS.SUBSCRIPTION_CANCELLED),
			),
		);
}

afterEach(async () => {
	if (createdSubscriptionIds.length > 0) {
		await db
			.delete(adminAuditLogs)
			.where(inArray(adminAuditLogs.targetId, createdSubscriptionIds));
		await db
			.delete(subscriptions)
			.where(inArray(subscriptions.id, createdSubscriptionIds));
	}
	if (createdUserIds.length > 0) {
		await db.delete(user).where(inArray(user.id, createdUserIds));
	}
	if (createdPlanIds.length > 0) {
		await db.delete(plans).where(inArray(plans.id, createdPlanIds));
	}
	createdSubscriptionIds.length = 0;
	createdUserIds.length = 0;
	createdPlanIds.length = 0;
});

const PERIOD_END = new Date("2035-01-01T00:00:00.000Z");

describe("cancel subscription at period end", () => {
	it("keeps the paid period, records the effective date, and audits the actor", async () => {
		const adminId = await createUser(USER_ROLES.ADMIN);
		const ownerId = await createUser(USER_ROLES.OWNER);
		const planId = await createPlan();
		const subscriptionId = await createSubscription(ownerId, planId);

		const result = await cancelSubscription(db, adminId, {
			ownerUserId: ownerId,
			reason: "Owner requested cancellation after the current term.",
		});

		expect(result.subscription.status).toBe(PLAN_STATUS.CANCELLED);
		// The mapped fields and the reported effective date share the admin-list
		// mapping, and the stored period end is unchanged (cancel does not shorten
		// the paid term).
		expect(result.effectiveAt).toEqual(result.subscription.currentPeriodEnd);
		const [stored] = await db
			.select()
			.from(subscriptions)
			.where(eq(subscriptions.id, subscriptionId));
		expect(stored?.status).toBe(PLAN_STATUS.CANCELLED);
		expect(stored?.currentPeriodEnd).toEqual(PERIOD_END);

		// Access is time-based, so a cancelled subscription with a future period
		// end is still entitled — the whole point of cancel-at-period-end.
		expect(await getOwnerEntitlement(db, ownerId)).toEqual({
			entitled: true,
			tenantLimit: 5,
		});

		const audits = await auditRowsFor(subscriptionId);
		expect(audits).toHaveLength(1);
		expect(audits[0]).toMatchObject({
			actorAdminUserId: adminId,
			action: ADMIN_AUDIT_ACTIONS.SUBSCRIPTION_CANCELLED,
			reason: "Owner requested cancellation after the current term.",
		});
		expect(audits[0]?.metadata).toMatchObject({
			ownerUserId: ownerId,
			previousStatus: PLAN_STATUS.ACTIVE,
		});
	});

	it("treats a repeat cancellation as idempotent with exactly one audit row", async () => {
		const adminId = await createUser(USER_ROLES.ADMIN);
		const ownerId = await createUser(USER_ROLES.OWNER);
		const planId = await createPlan();
		const subscriptionId = await createSubscription(ownerId, planId);

		await cancelSubscription(db, adminId, {
			ownerUserId: ownerId,
			reason: "First cancellation request.",
		});
		const second = await cancelSubscription(db, adminId, {
			ownerUserId: ownerId,
			reason: "Retry after a network timeout.",
		});

		expect(second.subscription.status).toBe(PLAN_STATUS.CANCELLED);
		expect(second.effectiveAt).toEqual(second.subscription.currentPeriodEnd);
		expect(await auditRowsFor(subscriptionId)).toHaveLength(1);
	});

	it("refuses a subscription whose paid period has already ended", async () => {
		const adminId = await createUser(USER_ROLES.ADMIN);
		const ownerId = await createUser(USER_ROLES.OWNER);
		const planId = await createPlan();
		const subscriptionId = await createSubscription(ownerId, planId, {
			currentPeriodEnd: new Date("2020-01-01T00:00:00.000Z"),
		});

		await expect(
			cancelSubscription(db, adminId, {
				ownerUserId: ownerId,
				reason: "Attempt to cancel a lapsed subscription.",
			}),
		).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

		const [unchanged] = await db
			.select()
			.from(subscriptions)
			.where(eq(subscriptions.id, subscriptionId));
		expect(unchanged?.status).toBe(PLAN_STATUS.ACTIVE);
		expect(await auditRowsFor(subscriptionId)).toHaveLength(0);
	});

	it("refuses a subscription with no paid period to end at", async () => {
		const adminId = await createUser(USER_ROLES.ADMIN);
		const ownerId = await createUser(USER_ROLES.OWNER);
		const planId = await createPlan();
		const subscriptionId = await createSubscription(ownerId, planId, {
			currentPeriodEnd: null,
		});

		await expect(
			cancelSubscription(db, adminId, {
				ownerUserId: ownerId,
				reason: "Attempt to cancel a subscription with no period end.",
			}),
		).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
		expect(await auditRowsFor(subscriptionId)).toHaveLength(0);
	});

	it("refuses demo identities and non-owner targets", async () => {
		const adminId = await createUser(USER_ROLES.ADMIN);
		const demoOwnerId = await createUser(
			USER_ROLES.OWNER,
			ACCOUNT_MODES.PUBLIC_DEMO,
		);
		const planId = await createPlan();
		await createSubscription(demoOwnerId, planId);

		await expect(
			cancelSubscription(db, adminId, {
				ownerUserId: demoOwnerId,
				reason: "Attempt to cancel a demo identity.",
			}),
		).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

		const tenantId = await createUser(USER_ROLES.TENANT);
		await expect(
			cancelSubscription(db, adminId, {
				ownerUserId: tenantId,
				reason: "Attempt to cancel a tenant as if an owner.",
			}),
		).rejects.toMatchObject({ code: "NOT_FOUND" });

		await expect(
			cancelSubscription(db, adminId, {
				ownerUserId: crypto.randomUUID(),
				reason: "Attempt to cancel an unknown owner.",
			}),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});
