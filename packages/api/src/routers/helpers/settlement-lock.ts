import { sql } from "drizzle-orm";

export type SettlementScope = "lease" | "utility";

// Neon HTTP has no callback transaction or FOR UPDATE. A single SQL statement
// can still serialize all writers for one balance using a transaction-scoped
// advisory lock; the statement must keep the lock CTE in the dependency chain.
export function settlementAdvisoryLock(scope: SettlementScope, id: string) {
	return sql`pg_advisory_xact_lock(
		hashtextextended(${`rently:settlement:${scope}:${id}`}, 0)
	)`;
}
