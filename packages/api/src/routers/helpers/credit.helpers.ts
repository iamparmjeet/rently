import { ORPCError } from "@orpc/server";
import type { Database } from "@rently/db";
import { PAYMENT_TYPES } from "@rently/db/constants/rent-constants";
import { billCredits, utilities } from "@rently/db/schema/schema";
import { eq, sql } from "drizzle-orm";
import { getSignedLedgerPayments } from "./signed-ledger";

export type DbTx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DbReader = Pick<Database, "select">;

function aggregateAmount(value: number | string | null | undefined): number {
	return Number(value ?? 0);
}

export async function getAmountDueForUtility(
	tx: DbTx | DbReader,
	utilityId: string,
) {
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
		.select({
			sum: sql<number | string>`coalesce(sum(${billCredits.amount}), 0)`,
		})
		.from(billCredits)
		.where(eq(billCredits.utilityId, utilityId));

	// 3. Sum the canonical utility ledger. Reversal rows retain their negative
	// sign but only count when their original was a utility payment.
	const ledger = await getSignedLedgerPayments(tx, {
		utilityIds: [utilityId],
	});
	const paid = ledger
		.filter((row) => row.category === PAYMENT_TYPES.UTILITY)
		.reduce((sum, row) => sum + row.amount, 0);

	// 4. Due = total + negative credits − paid (GST-safe: total immutable, credits separate rows)
	return utility.totalAmount + aggregateAmount(credits?.sum) - paid;
}

// Helper for UI/API: derived paid check without extra query when amountDue already computed
export function isPaidDerived(amountDue: number): boolean {
	return amountDue <= 0;
}

// Keep the legacy utilities.isPaid flag in sync with the derived amountDue after
// a credit or reversal changes the outstanding balance.
export async function syncUtilityPaidState(
	tx: DbTx | (Pick<Database, "update"> & DbReader),
	utilityId: string,
) {
	const dueAfter = await getAmountDueForUtility(tx, utilityId);
	await tx
		.update(utilities)
		.set({ isPaid: dueAfter <= 0 })
		.where(eq(utilities.id, utilityId));
}
