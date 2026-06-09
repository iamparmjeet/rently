import { ORPCError } from "@orpc/server";
import type { Database } from "@rently/db";
import { TENANT_LIMIT } from "@rently/db/constants/payment-constants";
import { LEASE_STATUSES } from "@rently/db/constants/rent-constants";
import { leases, properties, units } from "@rently/db/schema/schema";
import { plans, subscriptions } from "@rently/db/schema/subscription";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

export async function VerifyUnitOwnership(
	db: Database,
	userId: string,
	unitId: string,
): Promise<void> {
	const [result] = await db
		.select({ ownerId: properties.ownerId })
		.from(units)
		.innerJoin(properties, eq(units.propertyId, properties.id))
		.where(and(eq(units.id, unitId), isNull(units.deletedAt)))
		.limit(1);

	if (!result) {
		throw new ORPCError("NOT_FOUND", {
			message: "Unit Not Found",
		});
	}
	if (result.ownerId !== userId) {
		throw new ORPCError("FORBIDDEN", {
			message: "You don't own this unit.",
		});
	}
}

/**
 * Verify user owns the lease — throws if not found or not owner.
 * Use this for mandatory ownership checks in mutations.
 */
export async function VerifyLeaseOwnership(
	db: Database,
	userId: string,
	leaseId: string,
): Promise<void> {
	const [result] = await db
		.select({ ownerId: properties.ownerId })
		.from(leases)
		.innerJoin(units, eq(leases.unitId, units.id))
		.innerJoin(properties, eq(units.propertyId, properties.id))
		.where(eq(leases.id, leaseId))
		.limit(1);

	if (!result) {
		throw new ORPCError("NOT_FOUND", {
			message: "Lease Not Found",
		});
	}
	if (result.ownerId !== userId) {
		throw new ORPCError("FORBIDDEN", {
			message: "You don't have permission to access this lease",
		});
	}
}

/**
 * Check if user owns the lease — returns boolean.
 * Use this for conditional logic (e.g., UI permissions).
 */
export async function isLeaseOwner(
	db: Database,
	userId: string,
	leaseId: string,
): Promise<boolean> {
	const [result] = await db
		.select({ ownerId: properties.ownerId })
		.from(leases)
		.innerJoin(units, eq(leases.unitId, units.id))
		.innerJoin(properties, eq(units.propertyId, properties.id))
		.where(eq(leases.id, leaseId))
		.limit(1);

	return result?.ownerId === userId;
}

// ******************** Subscription Helpers ***************

export async function enforceSubscriptionLimit(
	db: Database,
	userId: string,
): Promise<void> {
	// 1) Fetch the user's plan tenant limit
	const [subRow] = await db
		.select({ tenantLimit: plans.tenantLimit })
		.from(subscriptions)
		.innerJoin(plans, eq(subscriptions.planId, plans.id))
		.where(eq(subscriptions.userId, userId))
		.orderBy(desc(subscriptions.createdAt))
		.limit(1);

	const tenantLimit = subRow?.tenantLimit ?? TENANT_LIMIT;

	// 2) Count distinct active tenants under this owner's properties
	const [countRow] = await db
		.select({
			count: sql<number>`count(distinct ${leases.tenantId})::int`,
		})
		.from(leases)
		.innerJoin(units, eq(leases.unitId, units.id))
		.innerJoin(properties, eq(units.propertyId, properties.id))
		.where(
			and(
				eq(properties.ownerId, userId),
				eq(leases.status, LEASE_STATUSES.ACTIVE),
			),
		);

	const currentCount = countRow?.count ?? 0;

	if (currentCount >= tenantLimit) {
		throw new ORPCError("FORBIDDEN", {
			message: `You've reached your plan limit of ${tenantLimit} active tenant${tenantLimit === 1 ? "" : "s"}. Upgrade to Pro to add more.`,
		});
	}
}
