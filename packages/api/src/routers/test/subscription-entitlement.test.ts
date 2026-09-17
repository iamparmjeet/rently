import { createDb } from "@rently/db";
import {
	PLAN_STATUS,
	TENANT_LIMIT,
} from "@rently/db/constants/payment-constants";
import { user } from "@rently/db/schema/auth";
import { plans, subscriptions } from "@rently/db/schema/subscription";
import { inArray } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

// Regression rationale (Fix-Plan: subscription entitlement enforcement):
// D04/D07 read the tenant limit from the latest subscription but ignored the
// subscription's lifecycle, so a cancelled or lapsed owner kept full plan
// access and any cancel control would have been a dead button. These tests pin
// the time-based entitlement rule that both the TypeScript read and the SQL
// guards (migration 0045) must agree on:
//   - no subscription row keeps the legacy TENANT_LIMIT fallback,
//   - active/trial with no end (or a future end) is entitled,
//   - cancelled with a FUTURE end stays entitled until the paid period ends
//     (cancel-at-period-end semantics),
//   - cancelled with a PAST end, or `expired = true`, is not entitled and the
//     seat/invite guards refuse (P0340/P0341) so activation cannot slip
//     through the SQL arbiter,
//   - status alone is not the boundary: a paused subscription inside its paid
//     period stays entitled.

import {
	assertPendingInviteQuotaSql,
	assertTenantSeatSql,
	getOwnerEntitlement,
	getOwnerTenantLimit,
	isPendingInviteQuotaError,
	isTenantPlanLimitError,
	tenantPlanLimitError,
} from "../helpers/tenant-limit";

const db = createDb();

const createdUserIds: string[] = [];
const createdPlanIds: string[] = [];
const createdSubscriptionIds: string[] = [];

async function createOwner() {
	const id = crypto.randomUUID();
	createdUserIds.push(id);
	await db.insert(user).values({
		id,
		name: "Entitlement Owner",
		email: `${id}@entitlement.keyhq.invalid`,
		role: "owner",
	});
	return id;
}

async function createPlan(tenantLimit: number) {
	const id = crypto.randomUUID();
	createdPlanIds.push(id);
	await db.insert(plans).values({
		id,
		name: "Entitlement Plan",
		slug: `entitlement-${id}`,
		tenantLimit,
		priceMonthly: 0,
	});
	return id;
}

async function createSubscription(
	ownerId: string,
	planId: string,
	overrides: {
		status?: (typeof PLAN_STATUS)[keyof typeof PLAN_STATUS];
		currentPeriodEnd?: Date | null;
		expired?: boolean;
	} = {},
) {
	const id = crypto.randomUUID();
	createdSubscriptionIds.push(id);
	await db.insert(subscriptions).values({
		id,
		userId: ownerId,
		planId,
		status: overrides.status ?? PLAN_STATUS.ACTIVE,
		currentPeriodEnd: overrides.currentPeriodEnd ?? null,
		expired: overrides.expired ?? false,
	});
	return id;
}

const PAST = new Date("2020-01-01T00:00:00.000Z");
const FUTURE = new Date("2035-01-01T00:00:00.000Z");

afterEach(async () => {
	if (createdSubscriptionIds.length > 0) {
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

describe("owner subscription entitlement", () => {
	it("keeps the TENANT_LIMIT fallback for an owner without a subscription", async () => {
		const ownerId = await createOwner();
		const entitlement = await getOwnerEntitlement(db, ownerId);
		expect(entitlement).toEqual({
			entitled: true,
			tenantLimit: TENANT_LIMIT,
		});
		expect(await getOwnerTenantLimit(db, ownerId)).toBe(TENANT_LIMIT);
	});

	it("grants the plan limit for an active subscription with no period end", async () => {
		const ownerId = await createOwner();
		const planId = await createPlan(3);
		await createSubscription(ownerId, planId, {
			status: PLAN_STATUS.ACTIVE,
			currentPeriodEnd: null,
		});

		expect(await getOwnerEntitlement(db, ownerId)).toEqual({
			entitled: true,
			tenantLimit: 3,
		});
	});

	it("grants the plan limit inside a paid period", async () => {
		const ownerId = await createOwner();
		const planId = await createPlan(7);
		await createSubscription(ownerId, planId, {
			status: PLAN_STATUS.ACTIVE,
			currentPeriodEnd: FUTURE,
		});

		expect(await getOwnerEntitlement(db, ownerId)).toEqual({
			entitled: true,
			tenantLimit: 7,
		});
	});

	it("keeps a cancelled-at-period-end owner entitled until the paid period ends", async () => {
		const ownerId = await createOwner();
		const planId = await createPlan(5);
		await createSubscription(ownerId, planId, {
			status: PLAN_STATUS.CANCELLED,
			currentPeriodEnd: FUTURE,
		});

		// The whole point of cancel-at-period-end: status flips, access does not.
		expect(await getOwnerEntitlement(db, ownerId)).toEqual({
			entitled: true,
			tenantLimit: 5,
		});
	});

	it("denies a cancellation whose paid period has lapsed", async () => {
		const ownerId = await createOwner();
		const planId = await createPlan(5);
		await createSubscription(ownerId, planId, {
			status: PLAN_STATUS.CANCELLED,
			currentPeriodEnd: PAST,
		});

		expect(await getOwnerEntitlement(db, ownerId)).toEqual({
			entitled: false,
			tenantLimit: 0,
		});
	});

	it("denies a subscription marked expired even inside its paid period", async () => {
		const ownerId = await createOwner();
		const planId = await createPlan(9);
		await createSubscription(ownerId, planId, {
			status: PLAN_STATUS.ACTIVE,
			currentPeriodEnd: FUTURE,
			expired: true,
		});

		expect(await getOwnerEntitlement(db, ownerId)).toEqual({
			entitled: false,
			tenantLimit: 0,
		});
	});

	it("treats a paused subscription inside its paid period as entitled", async () => {
		const ownerId = await createOwner();
		const planId = await createPlan(4);
		await createSubscription(ownerId, planId, {
			status: PLAN_STATUS.PAUSED,
			currentPeriodEnd: FUTURE,
		});

		// Entitlement is time-based by design; pause is not itself a boundary.
		expect(await getOwnerEntitlement(db, ownerId)).toEqual({
			entitled: true,
			tenantLimit: 4,
		});
	});
});

describe("SQL entitlement arbiters", () => {
	it("refuses a seat for a lapsed subscription and maps to the activation refusal", async () => {
		const ownerId = await createOwner();
		const planId = await createPlan(5);
		await createSubscription(ownerId, planId, {
			status: PLAN_STATUS.CANCELLED,
			currentPeriodEnd: PAST,
		});

		const error = await db
			.execute(assertTenantSeatSql(ownerId, crypto.randomUUID()))
			.then(() => null)
			.catch((caught: unknown) => caught);

		expect(error).not.toBeNull();
		expect(isTenantPlanLimitError(error)).toBe(true);
		await expect(tenantPlanLimitError(db, ownerId)).resolves.toMatchObject({
			message: expect.stringContaining("subscription has ended"),
		});
	});

	it("still allows a seat for an active subscription within its paid period", async () => {
		const ownerId = await createOwner();
		const planId = await createPlan(5);
		await createSubscription(ownerId, planId, {
			status: PLAN_STATUS.ACTIVE,
			currentPeriodEnd: FUTURE,
		});

		await expect(
			db.execute(assertTenantSeatSql(ownerId, crypto.randomUUID())),
		).resolves.toBeDefined();
	});

	it("refuses the invite quota for a lapsed subscription and maps to the pending refusal", async () => {
		const ownerId = await createOwner();
		const planId = await createPlan(5);
		await createSubscription(ownerId, planId, {
			status: PLAN_STATUS.CANCELLED,
			currentPeriodEnd: PAST,
		});

		const error = await db
			.execute(assertPendingInviteQuotaSql(ownerId))
			.then(() => null)
			.catch((caught: unknown) => caught);

		expect(error).not.toBeNull();
		expect(isPendingInviteQuotaError(error)).toBe(true);
	});
});
