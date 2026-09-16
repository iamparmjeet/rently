import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { db } from "./index";

const hardCheckNames = [
	"P1 payment reversal pairing",
	"P2 payment signs",
	"P3 payment reversal cardinality",
	"C1 credit reversal pairing",
	"C2 credit reversal state",
	"C3 cash refund pairing",
	"C4 refund recovery pairing",
	"C5 orphan refund payments",
	"C6 refund credit reversals",
	"G1 empty payment groups",
	"G2 grouped payment agreement scope",
	"G3 reversal group totals",
	"G4 reversal group membership",
	"R1 allocation provenance",
	"R2 charge capacity",
	"R3 payment allocation mirrors",
	"R4 credit allocation mirrors",
	"R5 adjustment credit completeness",
	"R6 payment allocation conservation",
	"U1 utility paid state",
	"U2 utility ledger scope",
	"S1 paid invoice truth",
	"S2 subscription total paid",
	"S3 paid invoice overlap",
	"S4 beta redemption counts",
] as const;

const auditResultSchema = z.object({
	rows: z.array(
		z.object({
			check_name: z.string(),
			severity: z.enum(["hard", "review"]),
			discrepancy_count: z.coerce.number(),
		}),
	),
});

const auditSql = readFileSync(
	new URL("./reconciliation.sql", import.meta.url),
	"utf8",
);

class FixtureRollback extends Error {}

function fixtureSql(statement: string): string {
	const suffix = crypto.randomUUID();
	return `
WITH owner_row AS (
  INSERT INTO "user" (id, name, email, role)
  VALUES (gen_random_uuid(), 'I02 audit owner', 'i02-${suffix}@test.keyhq.invalid', 'owner')
  RETURNING id
), property_row AS (
  INSERT INTO properties (id, owner_id, name, address, type)
  SELECT gen_random_uuid(), id, 'I02 audit property', 'I02 audit address', 'residential'
  FROM owner_row
  RETURNING id, owner_id
), unit_row AS (
  INSERT INTO units (id, property_id, unit_number, type, base_rent, status)
  SELECT gen_random_uuid(), id, 'I02-${suffix}', '1bhk', 10000, 'available'
  FROM property_row
  RETURNING id
), agreement_row AS (
  INSERT INTO lease_agreements (id, tenant_id, property_id, arrangement_type, category, start_date)
  SELECT gen_random_uuid(), owner_row.id, property_row.id, 'independent', 'residential', now()
  FROM owner_row CROSS JOIN property_row
  RETURNING id
), lease_row AS (
  INSERT INTO leases (id, unit_id, tenant_id, agreement_id, start_date, rent, status)
  SELECT gen_random_uuid(), unit_row.id, owner_row.id, agreement_row.id, now(), 10000, 'active'
  FROM unit_row CROSS JOIN owner_row CROSS JOIN agreement_row
  RETURNING id, agreement_id
)
${statement}`;
}

async function expectFixtureToTrip(
	statement: string,
	checkName: (typeof hardCheckNames)[number],
): Promise<void> {
	let tripped = false;
	try {
		await db.transaction(async (tx) => {
			await tx.execute(sql.raw(fixtureSql(statement)));
			const result = auditResultSchema.parse(
				await tx.execute(sql.raw(auditSql)),
			);
			tripped = result.rows.some(
				(row) => row.check_name === checkName && row.discrepancy_count > 0,
			);
			throw new FixtureRollback();
		});
	} catch (error) {
		if (!(error instanceof FixtureRollback)) {
			throw error;
		}
	}
	expect(tripped).toBe(true);
}

describe("I02 Signed Ledger Reconciliation Audit", () => {
	it("has no hard ledger discrepancies", async () => {
		const result = auditResultSchema.parse(await db.execute(sql.raw(auditSql)));
		const hardDiscrepancies = result.rows.filter(
			(row) => row.severity === "hard" && row.discrepancy_count > 0,
		);
		expect(hardDiscrepancies).toEqual([]);
		expect(
			result.rows
				.filter((row) => row.severity === "hard")
				.map((row) => row.check_name)
				.toSorted(),
		).toEqual(hardCheckNames.toSorted());
		expect(result.rows.filter((row) => row.severity === "review")).toHaveLength(
			3,
		);
	});

	it("detects swapped payment reversals between reversal groups", async () => {
		await expectFixtureToTrip(
			`, original_one AS (
  INSERT INTO payment_groups (id, agreement_id, payment_date)
  SELECT gen_random_uuid(), agreement_id, now() FROM lease_row RETURNING id
), original_two AS (
  INSERT INTO payment_groups (id, agreement_id, payment_date)
  SELECT gen_random_uuid(), agreement_id, now() FROM lease_row RETURNING id
), reversal_one AS (
  INSERT INTO payment_groups (id, agreement_id, payment_date, reverses_payment_group_id)
  SELECT gen_random_uuid(), lease_row.agreement_id, now(), original_one.id FROM lease_row CROSS JOIN original_one RETURNING id
), reversal_two AS (
  INSERT INTO payment_groups (id, agreement_id, payment_date, reverses_payment_group_id)
  SELECT gen_random_uuid(), lease_row.agreement_id, now(), original_two.id FROM lease_row CROSS JOIN original_two RETURNING id
), original_payments AS (
  INSERT INTO payments (id, lease_id, amount, payment_date, type, payment_group_id)
  SELECT gen_random_uuid(), lease_row.id, 10000, now(), 'rent', original_one.id FROM lease_row CROSS JOIN original_one
  UNION ALL
  SELECT gen_random_uuid(), lease_row.id, 10000, now(), 'rent', original_two.id FROM lease_row CROSS JOIN original_two
  RETURNING id, payment_group_id
)
INSERT INTO payments (id, lease_id, amount, payment_date, type, payment_group_id, reverses_payment_id)
SELECT gen_random_uuid(), lease_row.id, -10000, now(), 'reversal', reversal_two.id, original_payments.id
FROM lease_row CROSS JOIN reversal_two CROSS JOIN original_payments CROSS JOIN original_one
WHERE original_payments.payment_group_id = original_one.id
UNION ALL
SELECT gen_random_uuid(), lease_row.id, -10000, now(), 'reversal', reversal_one.id, original_payments.id
FROM lease_row CROSS JOIN reversal_one CROSS JOIN original_payments CROSS JOIN original_two
WHERE original_payments.payment_group_id = original_two.id`,
			"G4 reversal group membership",
		);
	});

	it("detects a rent payment whose allocations do not conserve its source amount", async () => {
		await expectFixtureToTrip(
			`, charge_row AS (
  INSERT INTO rent_charges (id, lease_id, period_key, due_date, amount)
  SELECT gen_random_uuid(), id, '2026-09', '2026-09-05', 10000 FROM lease_row RETURNING id
), payment_row AS (
  INSERT INTO payments (id, lease_id, amount, payment_date, type)
  SELECT gen_random_uuid(), id, 10000, now(), 'rent' FROM lease_row RETURNING id
)
INSERT INTO rent_allocations (id, charge_id, payment_id, amount)
SELECT gen_random_uuid(), charge_row.id, payment_row.id, 5000 FROM charge_row CROSS JOIN payment_row`,
			"R6 payment allocation conservation",
		);
	});

	it("detects a refund payment without its negative refund credit", async () => {
		await expectFixtureToTrip(
			`INSERT INTO payments (id, lease_id, amount, payment_date, type)
SELECT gen_random_uuid(), id, -10000, now(), 'refund' FROM lease_row`,
			"C5 orphan refund payments",
		);
	});

	it("detects a positive refund credit without its negative credit source", async () => {
		await expectFixtureToTrip(
			`INSERT INTO bill_credits (id, lease_id, owner_id, type, amount, reason, credit_note_no, applied_as, created_by)
SELECT gen_random_uuid(), lease_row.id, owner_row.id, 'discount', 10000, 'I02 invalid refund reversal', gen_random_uuid()::text, 'refund', owner_row.id
FROM lease_row CROSS JOIN owner_row`,
			"C6 refund credit reversals",
		);
	});
});
