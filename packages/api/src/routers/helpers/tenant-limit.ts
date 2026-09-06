import { ORPCError } from "@orpc/server";
import type { Database } from "@rently/db";
import { TENANT_LIMIT } from "@rently/db/constants/payment-constants";
import { tenantInvites } from "@rently/db/schema/schema";
import { plans, subscriptions } from "@rently/db/schema/subscription";
import { and, desc, eq, gt, isNull, or, type SQL, sql } from "drizzle-orm";

// D04: tenant-plan-limit enforcement. A "seat" is a distinct tenant with an
// active lease under the owner's properties (the count previously read by
// enforceSubscriptionLimit). Seats are consumed by exactly three activation
// paths — createLease, createCombinedLease, and updateLease reactivation —
// and are freed automatically because the count is derived from live rows,
// never materialized.

/** The owner's plan tenant limit; TENANT_LIMIT when no subscription exists. */
export async function getOwnerTenantLimit(
	db: Database,
	ownerId: string,
): Promise<number> {
	const [subRow] = await db
		.select({ tenantLimit: plans.tenantLimit })
		.from(subscriptions)
		.innerJoin(plans, eq(subscriptions.planId, plans.id))
		.where(eq(subscriptions.userId, ownerId))
		.orderBy(desc(subscriptions.createdAt))
		.limit(1);

	return subRow?.tenantLimit ?? TENANT_LIMIT;
}

/**
 * First statement of the activation transaction/batch. The SQL function takes
 * a transaction-scoped advisory lock on the owner's seat domain (serializing
 * concurrent activations), counts distinct active tenants excluding the one
 * being activated, and raises with ERRCODE P0340 — aborting the whole
 * transaction/batch — when the plan limit would be exceeded.
 */
export function assertTenantSeatSql(ownerId: string, tenantId: string): SQL {
	return sql`select rently_assert_tenant_seat(${ownerId}::uuid, ${tenantId}::uuid)`;
}

// Drizzle wraps driver errors (the Postgres code nests under cause); read the
// whole chain so the mapping works on the node-postgres and Neon HTTP paths
// (utility.ts violationCode precedent).
export function isTenantPlanLimitError(error: unknown): boolean {
	let current: unknown = error;
	for (let depth = 0; current && depth < 5; depth += 1) {
		const candidate = current as {
			code?: unknown;
			message?: unknown;
			cause?: unknown;
		};
		if (candidate.code === "P0340") return true;
		if (
			typeof candidate.message === "string" &&
			candidate.message.includes("TENANT_PLAN_LIMIT_REACHED")
		) {
			return true;
		}
		current = candidate.cause;
	}
	return false;
}

/** The FORBIDDEN activation refusal, worded like the shipped invite check. */
export async function tenantPlanLimitError(db: Database, ownerId: string) {
	const tenantLimit = await getOwnerTenantLimit(db, ownerId);
	return new ORPCError("FORBIDDEN", {
		message: `You've reached your plan limit of ${tenantLimit} active tenant${tenantLimit === 1 ? "" : "s"}. Upgrade to Pro to add more.`,
	});
}

/**
 * D04: pending invitations are quotaed separately from active seats — an
 * owner can hold at most their plan's tenantLimit concurrent pending invites
 * (not deleted, not past their expiry), regardless of how many seats are in
 * use. Atomicity of invite creation itself is D07's slice; this check is a
 * plain count-and-throw until then.
 */
export async function enforcePendingInviteQuota(
	db: Database,
	ownerId: string,
): Promise<void> {
	const tenantLimit = await getOwnerTenantLimit(db, ownerId);

	const [countRow] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(tenantInvites)
		.where(
			and(
				eq(tenantInvites.invitedById, ownerId),
				eq(tenantInvites.status, "pending"),
				isNull(tenantInvites.deletedAt),
				or(
					isNull(tenantInvites.expiresAt),
					gt(tenantInvites.expiresAt, new Date()),
				),
			),
		);

	if ((countRow?.count ?? 0) >= tenantLimit) {
		throw new ORPCError("FORBIDDEN", {
			message: `You've reached your plan limit of ${tenantLimit} pending invitation${tenantLimit === 1 ? "" : "s"}. Revoke one or wait for expiry before inviting again.`,
		});
	}
}
