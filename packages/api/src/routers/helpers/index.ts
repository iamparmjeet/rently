import { ORPCError } from "@orpc/server";
import type { Database } from "@rently/db";
import { leases, properties, units } from "@rently/db/schema/schema";
import { and, eq, isNull } from "drizzle-orm";

export async function VerifyUnitOwnership(
	db: Database,
	userId: string,
	unitId: string,
): Promise<void> {
	// E08: archived resources are historical-only — a live unit cannot exist
	// under an archived property through the API, but the gate holds regardless.
	const [result] = await db
		.select({ ownerId: properties.ownerId })
		.from(units)
		.innerJoin(properties, eq(units.propertyId, properties.id))
		.where(
			and(
				eq(units.id, unitId),
				isNull(units.deletedAt),
				isNull(properties.deletedAt),
			),
		)
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
 * E08: leases under archived properties/units are historical-only.
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
		.where(
			and(
				eq(leases.id, leaseId),
				isNull(units.deletedAt),
				isNull(properties.deletedAt),
			),
		)
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
 * E08: leases under archived properties/units are historical-only.
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
		.where(
			and(
				eq(leases.id, leaseId),
				isNull(units.deletedAt),
				isNull(properties.deletedAt),
			),
		)
		.limit(1);

	return result?.ownerId === userId;
}
