-- FKs are inline (not ALTERed) so the whole file can re-run safely; the
-- drizzle snapshot is unaffected.
CREATE TABLE IF NOT EXISTS "rent_backfill_exceptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"lease_id" uuid REFERENCES "public"."leases"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
	"payment_id" uuid REFERENCES "public"."payments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
	"credit_id" uuid REFERENCES "public"."bill_credits"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"detail" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rent_backfill_exceptions_kind_check" CHECK ("rent_backfill_exceptions"."kind" in ('lease_end_ambiguous', 'unallocated_source_remainder', 'unattributable_reversal'))
);
--> statement-breakpoint

-- ── C03 backfill (hand-authored below the generated DDL) ──────────────────
-- Populates rent_charges/rent_allocations from historical leases per
-- docs/Rent-Period-Rules.md (C01): a charge for every period the lease was
-- active, prorated at tenancy edges; historical rent flows allocated FIFO
-- oldest-period-first; payment/credit reversals mirrored from their originals.
-- Everything that does not fit deterministically lands in
-- rent_backfill_exceptions — nothing is invented and nothing is silently
-- dropped. Date math uses the stored wall-clock date part (the business date
-- the owner entered); G01 formalizes timezone handling later.
--
-- Idempotent by construction (IF NOT EXISTS + ON CONFLICT DO NOTHING +
-- exceptions recomputed from scratch), so re-running the file changes no rows.

DELETE FROM "rent_backfill_exceptions";--> statement-breakpoint

-- 1) Charges: one per lease per period, through the current IST month for
-- ongoing leases (no future periods — C04 creates those as months arrive).
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
	GREATEST(1, round(
		l."rent" * edges.active_days
		/ extract(day from (p_month + interval '1 month - 1 day'))::numeric
	)::int)
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
WHERE l."start_date"::date <= (now() AT TIME ZONE 'Asia/Kolkata')::date
	AND p_month::date <= (now() AT TIME ZONE 'Asia/Kolkata')::date
	AND (l."end_date" IS NOT NULL OR l."status" = 'active')
	AND (l."end_date" IS NULL OR l."end_date"::date >= p_month::date)
	AND edges.active_days > 0
ON CONFLICT ("lease_id", "period_key") DO NOTHING;--> statement-breakpoint

-- 2) FIFO allocation of historical rent flows into the charges (R7/R8).
-- Sources in business order: positive rent payments (by payment date) and
-- rent-scoped discount credits (by creation time). Reversals never enter the
-- stream — they mirror their originals in step 3. The interval-overlap join
-- splits each source across charges oldest-first: a charge occupies the
-- paise interval [s, e) of the lease's charge total, a source occupies
-- [u, v) of the lease's flow total, and their overlap is the allocation.
WITH stream AS (
	SELECT p."lease_id", p."id" AS payment_id, NULL::uuid AS credit_id,
		p."amount" AS contrib, p."payment_date" AS at
	FROM "payments" p
	WHERE p."type" = 'rent' AND p."amount" > 0
	UNION ALL
	SELECT c."lease_id", NULL::uuid, c."id", -c."amount", c."created_at"
	FROM "bill_credits" c
	WHERE c."utility_id" IS NULL AND c."amount" < 0
), src AS (
	SELECT s.*,
		SUM(s.contrib) OVER (PARTITION BY s.lease_id ORDER BY s.at, coalesce(s.payment_id, s.credit_id)
			ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) - s.contrib AS u,
		SUM(s.contrib) OVER (PARTITION BY s.lease_id ORDER BY s.at, coalesce(s.payment_id, s.credit_id)
			ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS v
	FROM stream s
), chg AS (
	SELECT c."id", c."lease_id", c."amount",
		SUM(c."amount") OVER (PARTITION BY c.lease_id ORDER BY c.period_key
			ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) - c."amount" AS s,
		SUM(c."amount") OVER (PARTITION BY c.lease_id ORDER BY c.period_key
			ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS e
	FROM "rent_charges" c
)
INSERT INTO "rent_allocations" ("id", "charge_id", "payment_id", "credit_id", "amount")
SELECT gen_random_uuid(), cb."id", sb."payment_id", sb."credit_id",
	(LEAST(cb.e, sb.v) - GREATEST(cb.s, sb.u))::int
FROM src sb
JOIN chg cb ON cb.lease_id = sb.lease_id
WHERE LEAST(cb.e, sb.v) > GREATEST(cb.s, sb.u)
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- 3) Reversal mirrors: a reversal's allocations negate its original's,
-- preserving the signed-ledger semantics (B03/B12) inside the period model.
INSERT INTO "rent_allocations" ("id", "charge_id", "payment_id", "amount")
SELECT gen_random_uuid(), oa."charge_id", r."id", -oa."amount"
FROM "payments" r
JOIN "payments" o
	ON o."id" = r."reverses_payment_id"
	OR (r."reverses_payment_id" IS NULL AND r."reference_number" = o."id"::text)
JOIN "rent_allocations" oa ON oa."payment_id" = o."id"
WHERE r."type" = 'reversal' AND o."type" = 'rent' AND o."lease_id" = r."lease_id"
ON CONFLICT DO NOTHING;--> statement-breakpoint

INSERT INTO "rent_allocations" ("id", "charge_id", "credit_id", "amount")
SELECT gen_random_uuid(), ca."charge_id", rc."id", -ca."amount"
FROM "bill_credits" rc
JOIN "rent_allocations" ca ON ca."credit_id" = rc."reverses_credit_id"
WHERE rc."utility_id" IS NULL AND rc."reverses_credit_id" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- 4) Exception report: list everything the deterministic backfill could not
-- explain. Every row is an owner-review item, not an auto-correction.
INSERT INTO "rent_backfill_exceptions" ("id", "lease_id", "kind", "amount", "detail")
SELECT gen_random_uuid(), l."id", 'lease_end_ambiguous', 0,
	'Lease is ' || l."status" || ' without an end date; when accrual stopped is unknowable, so no charges were created.'
FROM "leases" l
WHERE l."end_date" IS NULL AND l."status" <> 'active';--> statement-breakpoint

WITH stream AS (
	SELECT p."lease_id", p."id" AS payment_id, NULL::uuid AS credit_id,
		p."amount" AS contrib
	FROM "payments" p
	WHERE p."type" = 'rent' AND p."amount" > 0
	UNION ALL
	SELECT c."lease_id", NULL::uuid, c."id", -c."amount"
	FROM "bill_credits" c
	WHERE c."utility_id" IS NULL AND c."amount" < 0
)
INSERT INTO "rent_backfill_exceptions" ("id", "lease_id", "payment_id", "credit_id", "kind", "amount", "detail")
SELECT gen_random_uuid(), s."lease_id", s."payment_id", s."credit_id",
	'unallocated_source_remainder', s."contrib" - COALESCE(x."allocated", 0),
	'Deterministic charges absorb only part of this flow; the remainder needs an owner decision.'
FROM stream s
LEFT JOIN (
	SELECT ra."payment_id", ra."credit_id", SUM(ra."amount") AS allocated
	FROM "rent_allocations" ra
	GROUP BY ra."payment_id", ra."credit_id"
) x ON x."payment_id" IS NOT DISTINCT FROM s."payment_id"
	AND x."credit_id" IS NOT DISTINCT FROM s."credit_id"
WHERE s."contrib" - COALESCE(x."allocated", 0) > 0;--> statement-breakpoint

INSERT INTO "rent_backfill_exceptions" ("id", "lease_id", "payment_id", "credit_id", "kind", "amount", "detail")
SELECT gen_random_uuid(), r."lease_id", r."id", NULL, 'unattributable_reversal', -r."amount",
	'Reversal has no linked original payment; it could not be mirrored into the period model.'
FROM "payments" r
WHERE r."type" = 'reversal'
	AND r."reverses_payment_id" IS NULL
	AND NOT EXISTS (
		SELECT 1 FROM "payments" o WHERE o."id"::text = r."reference_number"
	);--> statement-breakpoint

INSERT INTO "rent_backfill_exceptions" ("id", "lease_id", "payment_id", "credit_id", "kind", "amount", "detail")
SELECT gen_random_uuid(), rc."lease_id", NULL, rc."id", 'unallocated_source_remainder', rc."amount",
	'Positive rent credit could not be mirrored to its target''s allocations.'
FROM "bill_credits" rc
WHERE rc."utility_id" IS NULL AND rc."amount" > 0
	AND NOT EXISTS (
		SELECT 1 FROM "rent_allocations" ra WHERE ra."credit_id" = rc."id"
	);
