import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "./index";

describe("I02 Signed Ledger Reconciliation Audit", () => {
	it("has no hard ledger discrepancies", async () => {
		const auditSql = readFileSync(
			new URL("./reconciliation.sql", import.meta.url),
			"utf8",
		);
		const result = (await db.execute(sql.raw(auditSql))) as unknown as {
			rows: Array<{
				check_name: string;
				severity: "hard" | "review";
				discrepancy_count: string;
			}>;
		};
		const hardDiscrepancies = result.rows.filter(
			(row) => row.severity === "hard" && Number(row.discrepancy_count) > 0,
		);
		expect(hardDiscrepancies).toEqual([]);
		expect(result.rows.filter((row) => row.severity === "review")).toHaveLength(
			3,
		);
	});
});
