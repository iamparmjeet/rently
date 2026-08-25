import { ORPCError } from "@orpc/server";
import type { Database } from "@rently/db";
import {
	billCredits,
	leases,
	payments,
	utilities,
} from "@rently/db/schema/schema";
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

	// 2. Sum all discounts for this bill (negative credits + positive reversals net; reversedAt is audit only)
	const [credits] = await tx
		.select({ sum: sql<number>`coalesce(sum(${billCredits.amount}), 0)` })
		.from(billCredits)
		.where(eq(billCredits.utilityId, utilityId));

	// 3. Sum all payments already recorded against this utility (reversal is negative, naturally nets)
	const [paid] = await tx
		.select({ sum: sql<number>`coalesce(sum(${payments.amount}), 0)` })
		.from(payments)
		.where(eq(payments.utilityId, utilityId));

	// 4. Due = total + negative credits − paid (GST-safe: total immutable, credits separate rows)
	return utility.totalAmount + (credits?.sum ?? 0) - (paid?.sum ?? 0);
}

export async function getAmountDueForRent(tx: DbTx, leaseId: string) {
	// 1. Get rent (beta: simple outstanding = lease.rent − paid − credits; period-aware ledger follows later)
	const [lease] = await tx
		.select({ rent: leases.rent })
		.from(leases)
		.where(eq(leases.id, leaseId))
		.limit(1);

	if (!lease) throw new ORPCError("NOT_FOUND", { message: "Lease not found" });

	// 2. Sum all rent/general credits (negative + positive reversals net)
	const [credits] = await tx
		.select({ sum: sql<number>`coalesce(sum(${billCredits.amount}), 0)` })
		.from(billCredits)
		.where(
			and(eq(billCredits.leaseId, leaseId), isNull(billCredits.utilityId)),
		);

	// 3. Sum all rent payments for this lease (utilityId null → rent/general). Reversal is negative and nets.
	const [paid] = await tx
		.select({ sum: sql<number>`coalesce(sum(${payments.amount}), 0)` })
		.from(payments)
		.where(and(eq(payments.leaseId, leaseId), isNull(payments.utilityId)));

	// 4. Due = rent + credits − paid; isPaidDerived = amountDue <= 0 (beta simple, no period key)
	return lease.rent + (credits?.sum ?? 0) - (paid?.sum ?? 0);
}

// Helper for UI/API: derived paid check without extra query when amountDue already computed
export function isPaidDerived(amountDue: number): boolean {
	return amountDue <= 0;
}
