CREATE TABLE "lease_agreements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"arrangement_type" text NOT NULL,
	"category" text NOT NULL,
	"rent_due_date" integer,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"notice" integer,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_groups" (
	"id" uuid PRIMARY KEY NOT NULL,
	"agreement_id" uuid NOT NULL,
	"payment_date" timestamp NOT NULL,
	"payment_method" text,
	"reference_number" text,
	"description" text,
	"reverses_payment_group_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "agreement_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "payment_group_id" uuid;--> statement-breakpoint
ALTER TABLE "lease_agreements" ADD CONSTRAINT "lease_agreements_tenant_id_user_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_agreements" ADD CONSTRAINT "lease_agreements_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_groups" ADD CONSTRAINT "payment_groups_agreement_id_lease_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."lease_agreements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_groups" ADD CONSTRAINT "payment_groups_reverses_payment_group_id_payment_groups_id_fk" FOREIGN KEY ("reverses_payment_group_id") REFERENCES "public"."payment_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_agreement_id_lease_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."lease_agreements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_group_id_payment_groups_id_fk" FOREIGN KEY ("payment_group_id") REFERENCES "public"."payment_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Before combined agreements existed, every lease was its own legal/tenancy
-- agreement. Reusing the lease UUID makes the backfill deterministic without a
-- database UUID extension. Existing lease columns and values stay untouched.
INSERT INTO "lease_agreements" (
	"id",
	"tenant_id",
	"property_id",
	"arrangement_type",
	"category",
	"rent_due_date",
	"start_date",
	"end_date",
	"notice",
	"description",
	"created_at",
	"updated_at"
)
SELECT
	l."id",
	l."tenant_id",
	u."property_id",
	'independent',
	CASE WHEN u."type" = 'shop' THEN 'commercial' ELSE 'residential' END,
	l."rent_due_date",
	l."start_date",
	l."end_date",
	l."notice",
	l."description",
	l."created_at",
	l."updated_at"
FROM "leases" l
INNER JOIN "units" u ON u."id" = l."unit_id";--> statement-breakpoint

-- Only the new expand-stage relationship column is populated. It intentionally
-- remains nullable so old and not-yet-migrated writers can coexist during rollout.
UPDATE "leases"
SET "agreement_id" = "id"
WHERE "agreement_id" IS NULL;--> statement-breakpoint

-- Each historical payment represented one real-world transfer, so it receives
-- one payment group. Transfer metadata and audit timestamps are copied verbatim;
-- the payment allocation itself is not rewritten.
INSERT INTO "payment_groups" (
	"id",
	"agreement_id",
	"payment_date",
	"payment_method",
	"reference_number",
	"description",
	"created_at",
	"updated_at"
)
SELECT
	p."id",
	l."agreement_id",
	p."payment_date",
	p."payment_method",
	p."reference_number",
	p."description",
	p."created_at",
	p."updated_at"
FROM "payments" p
INNER JOIN "leases" l ON l."id" = p."lease_id";--> statement-breakpoint

-- Historical voids store the original payment UUID in reference_number. Link
-- the reversal group only when that reference resolves; malformed legacy text
-- remains preserved on the group without inventing an audit relationship.
UPDATE "payment_groups" reversal_group
SET "reverses_payment_group_id" = original_group."id"
FROM "payments" reversal_payment
INNER JOIN "payments" original_payment
	ON original_payment."id"::text = reversal_payment."reference_number"
INNER JOIN "payment_groups" original_group
	ON original_group."id" = original_payment."id"
WHERE reversal_group."id" = reversal_payment."id"
	AND reversal_payment."type" = 'reversal';--> statement-breakpoint

UPDATE "payments"
SET "payment_group_id" = "id"
WHERE "payment_group_id" IS NULL;--> statement-breakpoint

-- These are migration-time completeness checks, not NOT NULL constraints. A
-- later contract migration may enforce required relationships after every
-- compatibility writer has been upgraded.
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "leases" WHERE "agreement_id" IS NULL) THEN
		RAISE EXCEPTION 'lease agreement backfill left unlinked leases';
	END IF;

	IF EXISTS (SELECT 1 FROM "payments" WHERE "payment_group_id" IS NULL) THEN
		RAISE EXCEPTION 'payment group backfill left unlinked payments';
	END IF;
END
$$;
