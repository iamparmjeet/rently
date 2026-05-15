import { ORPCError } from "@orpc/client";
import { StatusPhrase } from "@rently/api/utils";
import type { Database } from "@rently/db";
import { leases, properties, units } from "@rently/db/schema/schema";
import { eq } from "drizzle-orm";

export async function VerifyUnitOwnership(
	db: Database,
	userId: string,
	unitId: string,
): Promise<void> {
	const [result] = await db
		.select({ ownerId: properties.ownerId })
		.from(units)
		.innerJoin(properties, eq(units.propertyId, properties.id))
		.where(eq(units.id, unitId))
		.limit(1);

	if (!result) {
		throw new ORPCError(StatusPhrase.NOT_FOUND, {
			message: "Unit Not Found",
		});
	}
	if (result.ownerId !== userId) {
		throw new ORPCError(StatusPhrase.FORBIDDEN, {
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
		throw new ORPCError(StatusPhrase.NOT_FOUND, {
			message: "Lease Not Found",
		});
	}
	if (result.ownerId !== userId) {
		throw new ORPCError(StatusPhrase.FORBIDDEN, {
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
