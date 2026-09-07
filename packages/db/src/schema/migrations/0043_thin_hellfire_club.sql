ALTER TABLE "rent_backfill_exceptions" DROP CONSTRAINT "rent_backfill_exceptions_kind_check";--> statement-breakpoint
ALTER TABLE "rent_backfill_exceptions" ADD CONSTRAINT "rent_backfill_exceptions_kind_check" CHECK ("rent_backfill_exceptions"."kind" in ('lease_end_ambiguous', 'unallocated_source_remainder', 'unattributable_reversal', 'calendar_semantics_review'));--> statement-breakpoint

-- R3 repair: retain the charge but move only its derived due-date metadata
-- forward to the first valid date. No amount, payment, credit, or allocation
-- is changed by this migration.
WITH local_dates AS (
	SELECT l."id", l."rent_due_date",
		(l."start_date" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date AS "start_date"
	FROM "leases" l
)
UPDATE "rent_charges" c
SET "due_date" = make_date(
	extract(year FROM (date_trunc('month', d."start_date") + interval '1 month'))::int,
	extract(month FROM (date_trunc('month', d."start_date") + interval '1 month'))::int,
	least(coalesce(d."rent_due_date", extract(day FROM d."start_date")::int),
		extract(day FROM (date_trunc('month', d."start_date") + interval '2 months - 1 day'))::int)
)
FROM local_dates d
WHERE c."lease_id" = d."id"
	AND c."period_key" = to_char(date_trunc('month', d."start_date"), 'YYYY-MM')
	AND c."due_date" < d."start_date";--> statement-breakpoint

-- Period/amount repair can require moving allocation links. Flag candidates
-- for the reconciliation audit instead of silently changing ledger history.
WITH candidates AS (
	SELECT DISTINCT l."id"
	FROM "leases" l
	JOIN "rent_charges" c ON c."lease_id" = l."id"
	WHERE c."period_key" < to_char(
		date_trunc('month', (l."start_date" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date),
		'YYYY-MM'
	)
	OR (
		l."end_date" IS NOT NULL
		AND c."period_key" > to_char(
			date_trunc('month', (l."end_date" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date),
			'YYYY-MM'
		)
	)
)
INSERT INTO "rent_backfill_exceptions" ("id", "lease_id", "kind", "amount", "detail")
SELECT gen_random_uuid(), c."id", 'calendar_semantics_review', 0,
	'UTC/IST calendar mismatch candidate: review period charges and allocations before any reassignment.'
FROM candidates c
WHERE NOT EXISTS (
	SELECT 1 FROM "rent_backfill_exceptions" e
	WHERE e."lease_id" = c."id" AND e."kind" = 'calendar_semantics_review'
);
