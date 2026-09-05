import { type SQL, sql } from "drizzle-orm";

// ── Period-aware rent dual-write (C04; rules in docs/Rent-Period-Rules.md) ──
// Every statement here is a single self-contained SQL statement so the node
// transaction path and the Neon HTTP batch path run the identical logic
// (Neon batches are transactional). All of them are idempotent under the
// (payment_id/credit_id, charge_id) unique indexes.

const IST_TODAY = sql`(now() AT TIME ZONE 'Asia/Kolkata')::date`;

// Accrue any missing charges for a lease (R2–R5): one per period the lease
// was active, through the current IST month for ongoing leases, prorated at
// tenancy edges, due date = min(rentDueDate | start day, month length).
// Called at lease creation (R13: a backdated start immediately owes every
// elapsed period) and before every rent allocation. `gate` optionally ties
// the accrual to the existence of the settlement row being written, so a
// suppressed Neon insert leaves zero side effects.
export function ensureAccruedChargesSql(
	scope: { leaseId: string } | { agreementId: string },
	gate?: SQL,
): SQL {
	const leaseFilter =
		"leaseId" in scope
			? sql`l."id" = ${scope.leaseId}`
			: sql`l."agreement_id" = ${scope.agreementId} AND l."status" = 'active'`;
	const gateFilter = gate ? sql` AND EXISTS (${gate})` : sql``;
	return sql`
		INSERT INTO "rent_charges" ("id", "lease_id", "period_key", "due_date", "amount")
		SELECT
			gen_random_uuid(),
			l."id",
			to_char(p_month, 'YYYY-MM'),
			make_date(
				extract(year from p_month)::int,
				extract(month from p_month)::int,
				least(
					coalesce(l."rent_due_date", extract(day from l."start_date")::int),
					extract(day from (p_month + interval '1 month - 1 day'))::int
				)
			),
			round(
				l."rent" * edges.active_days
				/ extract(day from (p_month + interval '1 month - 1 day'))::numeric
			)::int
		FROM "leases" l
		CROSS JOIN LATERAL generate_series(
			date_trunc('month', l."start_date"),
			date_trunc('month', coalesce(l."end_date", (now() AT TIME ZONE 'Asia/Kolkata')::timestamp)),
			interval '1 month'
		) AS p_month
		CROSS JOIN LATERAL (
			SELECT GREATEST(0,
				LEAST(
					(p_month + interval '1 month - 1 day')::date,
					coalesce(l."end_date"::date, (p_month + interval '1 month - 1 day')::date)
				) - GREATEST(p_month::date, l."start_date"::date) + 1
			) AS active_days
		) edges
		WHERE ${leaseFilter}${gateFilter}
			AND l."start_date"::date <= ${IST_TODAY}
			AND p_month::date <= ${IST_TODAY}
			AND (l."end_date" IS NOT NULL OR l."status" = 'active')
			AND (l."end_date" IS NULL OR l."end_date"::date >= p_month::date)
			AND edges.active_days > 0
		ON CONFLICT ("lease_id", "period_key") DO NOTHING`;
}

// FIFO pour (R7/R8): every rent payment matched by `sourceWhere` is spread
// across its lease's outstanding charges oldest-period-first. A charge
// occupies the paise range of the lease's cumulative outstanding, a source
// the range of the lease's cumulative contribution — the overlap is the
// allocation. Sources on leases without charges (or past the charge total)
// simply do not fit; the remainder reporter lists them.
export function allocateRentPaymentsSql(sourceWhere: SQL): SQL {
	return sql`
		WITH src AS (
			SELECT p."id" AS payment_id, p."lease_id", p."amount" AS contrib
			FROM "payments" p
			WHERE ${sourceWhere}
		), chg_out AS (
			SELECT c."id", c."lease_id", c."period_key",
				c."amount" - COALESCE((
					SELECT SUM(ra."amount") FROM "rent_allocations" ra
					WHERE ra."charge_id" = c."id"
				), 0) AS outstanding
			FROM "rent_charges" c
			WHERE c."lease_id" IN (SELECT lease_id FROM src)
		), src_bounds AS (
			SELECT s.*,
				SUM(s.contrib) OVER (PARTITION BY s.lease_id ORDER BY s.payment_id
					ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) - s.contrib AS u,
				SUM(s.contrib) OVER (PARTITION BY s.lease_id ORDER BY s.payment_id
					ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS v
			FROM src s
		), chg_bounds AS (
			SELECT c.*,
				SUM(c.outstanding) OVER (PARTITION BY c.lease_id ORDER BY c.period_key
					ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) - c.outstanding AS s,
				SUM(c.outstanding) OVER (PARTITION BY c.lease_id ORDER BY c.period_key
					ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS e
			FROM chg_out c
		)
		INSERT INTO "rent_allocations" ("id", "charge_id", "payment_id", "amount")
		SELECT gen_random_uuid(), cb."id", sb."payment_id",
			(LEAST(cb.e, sb.v) - GREATEST(cb.s, sb.u))::int
		FROM src_bounds sb
		JOIN chg_bounds cb ON cb.lease_id = sb.lease_id
		WHERE LEAST(cb.e, sb.v) > GREATEST(cb.s, sb.u)
		ON CONFLICT DO NOTHING`;
}

// Same pour for a rent-scoped credit: a −paise discount settles +paise of the
// oldest outstanding charges (sign inversion, C02).
export function allocateRentCreditSql(creditId: string): SQL {
	return sql`
		WITH src AS (
			SELECT c."lease_id", -c."amount" AS contrib
			FROM "bill_credits" c WHERE c."id" = ${creditId}
		), chg_out AS (
			SELECT c."id", c."period_key",
				c."amount" - COALESCE((
					SELECT SUM(ra."amount") FROM "rent_allocations" ra
					WHERE ra."charge_id" = c."id"
				), 0) AS outstanding
			FROM "rent_charges" c
			WHERE c."lease_id" IN (SELECT lease_id FROM src)
		), chg_bounds AS (
			SELECT c.*,
				SUM(c.outstanding) OVER (ORDER BY c.period_key
					ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) - c.outstanding AS s,
				SUM(c.outstanding) OVER (ORDER BY c.period_key
					ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS e
			FROM chg_out c
		)
		INSERT INTO "rent_allocations" ("id", "charge_id", "credit_id", "amount")
		SELECT gen_random_uuid(), cb."id", ${creditId},
			(LEAST(cb.e, src.contrib) - GREATEST(cb.s, 0))::int
		FROM chg_bounds cb, src
		WHERE LEAST(cb.e, src.contrib) > GREATEST(cb.s, 0)
			AND EXISTS (SELECT 1 FROM "bill_credits" c WHERE c."id" = ${creditId})
		ON CONFLICT DO NOTHING`;
}

// A payment reversal undoes exactly its original's allocations (B03/B12
// semantics carried into the period model).
export function mirrorPaymentReversalSql(
	reversalId: string,
	originalId: string,
): SQL {
	return sql`
		INSERT INTO "rent_allocations" ("id", "charge_id", "payment_id", "amount")
		SELECT gen_random_uuid(), oa."charge_id", ${reversalId}, -oa."amount"
		FROM "rent_allocations" oa
		WHERE oa."payment_id" = ${originalId}
		ON CONFLICT DO NOTHING`;
}

// Group void: mirror every original allocation for the reversal rows of one
// reversal group.
export function mirrorPaymentGroupReversalsSql(reversalGroupId: string): SQL {
	return sql`
		INSERT INTO "rent_allocations" ("id", "charge_id", "payment_id", "amount")
		SELECT gen_random_uuid(), oa."charge_id", rv."id", -oa."amount"
		FROM "payments" rv
		JOIN "rent_allocations" oa ON oa."payment_id" = rv."reverses_payment_id"
		WHERE rv."payment_group_id" = ${reversalGroupId}
		ON CONFLICT DO NOTHING`;
}

// A credit reversal undoes exactly its original's allocations.
export function mirrorCreditReversalSql(reversalCreditId: string): SQL {
	return sql`
		INSERT INTO "rent_allocations" ("id", "charge_id", "credit_id", "amount")
		SELECT gen_random_uuid(), ca."charge_id", rc."id", -ca."amount"
		FROM "bill_credits" rc
		JOIN "rent_allocations" ca ON ca."credit_id" = rc."reverses_credit_id"
		WHERE rc."id" = ${reversalCreditId}
		ON CONFLICT DO NOTHING`;
}

// Divergent histories (the lifetime model under-charged) can leave part of a
// new payment without charges to fill — that remainder is listed for the
// owner, never dropped or invented (C03's exception discipline, live).
export function reportUnallocatedRentPaymentRemaindersSql(
	sourceWhere: SQL,
): SQL {
	return sql`
		INSERT INTO "rent_backfill_exceptions" ("id", "lease_id", "payment_id", "kind", "amount", "detail")
		SELECT gen_random_uuid(), p."lease_id", p."id", 'unallocated_source_remainder',
			p."amount" - COALESCE((
				SELECT SUM(ra."amount") FROM "rent_allocations" ra
				WHERE ra."payment_id" = p."id"
			), 0),
			'Deterministic charges absorb only part of this flow; the remainder needs an owner decision.'
		FROM "payments" p
		WHERE ${sourceWhere}
			AND p."type" = 'rent'
			AND p."amount" - COALESCE((
				SELECT SUM(ra."amount") FROM "rent_allocations" ra
				WHERE ra."payment_id" = p."id"
			), 0) > 0`;
}
