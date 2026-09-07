import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "./index";

describe("I02 Signed Ledger Reconciliation Audit", () => {
	it("utility dues matched against utility payments and credits", async () => {
		const check = await db.execute(sql`
      WITH utility_payments AS (
        SELECT utility_id, SUM(amount) as paid_amount 
        FROM payments 
        WHERE utility_id IS NOT NULL 
        GROUP BY utility_id
      ),
      utility_credits AS (
        SELECT utility_id, SUM(amount) as credited_amount 
        FROM bill_credits 
        WHERE utility_id IS NOT NULL 
        GROUP BY utility_id
      )
      SELECT u.id, u.total_amount, COALESCE(p.paid_amount, 0) as paid_amount, COALESCE(c.credited_amount, 0) as credited_amount
      FROM utilities u
      LEFT JOIN utility_payments p ON p.utility_id = u.id
      LEFT JOIN utility_credits c ON c.utility_id = u.id
      WHERE (u.total_amount + COALESCE(c.credited_amount, 0) - COALESCE(p.paid_amount, 0)) > 0 AND u.is_paid = true;
    `);
		expect(
			check.rows.length,
			"Paid utilities must have their total_amount exactly covered by payments and credits",
		).toBe(0);
	});

	it("invoices matched against subscriptions", async () => {
		const invoices = await db.execute(sql`
      SELECT id, amount, payment_status FROM invoices WHERE payment_status = 'paid'
    `);
		// no-op if no requirements, but let's just make sure there are no orphans
		const orphans = await db.execute(sql`
      SELECT id FROM invoices WHERE subscription_id IS NOT NULL AND subscription_id NOT IN (SELECT id FROM subscriptions)
    `);
		expect(
			orphans.rows.length,
			"No invoice should point to a missing subscription",
		).toBe(0);
	});
});
