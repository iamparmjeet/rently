import { sql } from "drizzle-orm";

// D01: the single idempotent provisioning statement for a user's free
// subscription. The unique index `subscriptions_user_id_unique` (0033) is the
// race arbiter: concurrent first calls (GET-time lazily provisioning, the
// better-auth signup hook, seed scripts) all attempt this insert, exactly one
// wins, and every caller then reads the same row. Plan columns (status,
// billing interval, period start, expired) come from the table defaults.
//
// When the "free" plan is not seeded the SELECT is empty and nothing is
// inserted — callers keep their existing "no subscription" behavior.
export function ensureFreeSubscriptionSql(userId: string) {
	return sql`
		INSERT INTO "subscriptions" ("id", "user_id", "plan_id")
		SELECT gen_random_uuid(), ${userId}, p."id"
		FROM "plans" p
		WHERE p."slug" = 'free'
		ON CONFLICT ("user_id") DO NOTHING`;
}
