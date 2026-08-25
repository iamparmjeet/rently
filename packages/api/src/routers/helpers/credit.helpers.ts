import { ORPCError } from "@orpc/server";
import type { Database } from "@rently/db";
import { billCredits, leases, utilities } from "@rently/db/schema/schema";
import { and, eq, isNull, sql } from "drizzle-orm";

export type DbTx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function getAmountDueForUtility(tx: DbTx, utilityId: string) {
	// 1. Get bill total
	const [utility] = await tx
		.select({ totalAmount: utilities.totalAmount })
		.from(utilities)
		.where(eq(utilities.id, utilityId))
		.limit(1);

	if (!utility)
		throw new ORPCError("NOT_FOUND", { message: "Utility not found" });

	// 2. Sum all active discounts for this bill
	const [credits] = await tx
		.select({ sum: sql<number>`coalesce(sum(${billCredits.amount}), 0)` })
		.from(billCredits)
		.where(
			and(eq(billCredits.utilityId, utilityId), isNull(billCredits.reversedAt)),
		);

	// 3. Due = total + negative credits
	// return utility.totalAmount + credits.sum;
	return utility.totalAmount + (credits?.sum ?? 0);
}

export async function getAmountDueForRent(tx: DbTx, leaseId: string) {
	// 1. Get rent
	const [lease] = await tx
		.select({ rent: leases.rent })
		.from(leases)
		.where(eq(leases.id, leaseId))
		.limit(1);

	if (!lease) throw new ORPCError("NOT_FOUND", { message: "Lease not found" });

	// 2. Sum all active discounts for this bill
	const [credits] = await tx
		.select({ sum: sql<number>`coalesce(sum(${billCredits.amount}), 0)` })
		.from(billCredits)
		.where(
			and(
				eq(billCredits.leaseId, leaseId),
				isNull(billCredits.utilityId),
				isNull(billCredits.reversedAt),
			),
		);

	// 3. Due = total + negative credits
	return lease.rent + (credits?.sum ?? 0);
}
