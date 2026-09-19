import { ORPCError } from "@orpc/server";
import type { Database } from "@rently/db";
import { TENANT_LIMIT } from "@rently/db/constants/payment-constants";
import { plans, subscriptions } from "@rently/db/schema/subscription";
import { type SQL, sql } from "drizzle-orm";

// D04: tenant-plan-limit enforcement. A "seat" is a distinct tenant with an
// active lease under the owner's properties (the count previously read by
// enforceSubscriptionLimit). Seats are consumed by exactly three activation
// paths — createLease, createCombinedLease, and updateLease reactivation —
// and are freed automatically because the count is derived from live rows,
// never materialized.

export type OwnerEntitlement = {
	/** False once the paid period lapses or the subscription is marked expired. */
	entitled: boolean;
	/** The plan limit while entitled; 0 once lapsed. */
	tenantLimit: number;
};

/**
 * The owner's effective subscription entitlement. Entitlement is TIME-based:
 * the latest subscription grants its plan limit while it is not `expired` and
 * its paid period has not lapsed. Cancellation keeps `current_period_end`, so
 * access survives to the end of the paid period. An owner with no subscription
 * row keeps the legacy TENANT_LIMIT fallback, so onboarding is unchanged.
 *
 * The predicates are compared in SQL against `now() at time zone 'utc'`
 * because `subscriptions.current_period_end` is a zone-less `timestamp`
 * holding UTC wall clock (D03 convention). Migration 0045 mirrors these exact
 * predicates in `rently_assert_tenant_seat` /
 * `rently_assert_pending_invite_quota`; those guards, not this read, arbitrate.
 */
export async function getOwnerEntitlement(
	db: Database,
	ownerId: string,
): Promise<OwnerEntitlement> {
	const result = await db.execute<{
		entitled: boolean;
		tenant_limit: number | null;
	}>(sql`
		SELECT
			(
				s."expired" IS NOT TRUE
				AND (
					s."current_period_end" IS NULL
					OR s."current_period_end" > (now() AT TIME ZONE 'utc')
				)
			) AS "entitled",
			p."tenant_limit" AS "tenant_limit"
		FROM ${subscriptions} s
		JOIN ${plans} p ON p."id" = s."plan_id"
		WHERE s."user_id" = ${ownerId}
		ORDER BY s."created_at" DESC, s."id" DESC
		LIMIT 1
	`);

	const row = result.rows[0];
	if (!row) return { entitled: true, tenantLimit: TENANT_LIMIT };

	const entitled = Boolean(row.entitled);
	return {
		entitled,
		tenantLimit: entitled ? (row.tenant_limit ?? TENANT_LIMIT) : 0,
	};
}

/** The owner's plan tenant limit; 0 once the subscription has lapsed. */
export async function getOwnerTenantLimit(
	db: Database,
	ownerId: string,
): Promise<number> {
	return (await getOwnerEntitlement(db, ownerId)).tenantLimit;
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

/** First statement of invite creation; serializes and checks pending quota. */
export function assertPendingInviteQuotaSql(ownerId: string): SQL {
	return sql`select rently_assert_pending_invite_quota(${ownerId}::uuid)`;
}

export function isPendingInviteQuotaError(error: unknown): boolean {
	let current: unknown = error;
	for (let depth = 0; current && depth < 5; depth += 1) {
		const candidate = current as {
			code?: unknown;
			message?: unknown;
			cause?: unknown;
		};
		if (candidate.code === "P0341") return true;
		if (
			typeof candidate.message === "string" &&
			candidate.message.includes("PENDING_INVITE_LIMIT_REACHED")
		) {
			return true;
		}
		current = candidate.cause;
	}
	return false;
}

// One refusal for a lapsed subscription, so a cancelled owner reads a
// renewal prompt instead of a nonsensical "plan limit of 0".
function subscriptionLapsedError() {
	return new ORPCError("FORBIDDEN", {
		message:
			"Your subscription has ended. Renew your plan to keep managing tenants.",
	});
}

export async function pendingInviteQuotaError(db: Database, ownerId: string) {
	const { entitled, tenantLimit } = await getOwnerEntitlement(db, ownerId);
	if (!entitled) return subscriptionLapsedError();
	return new ORPCError("FORBIDDEN", {
		message: `You've reached your plan limit of ${tenantLimit} pending invitation${tenantLimit === 1 ? "" : "s"}. Revoke one or wait for expiry before inviting again.`,
	});
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
	const { entitled, tenantLimit } = await getOwnerEntitlement(db, ownerId);
	if (!entitled) return subscriptionLapsedError();
	return new ORPCError("FORBIDDEN", {
		message: `You've reached your plan limit of ${tenantLimit} active tenant${tenantLimit === 1 ? "" : "s"}. Upgrade to Pro to add more.`,
	});
}
