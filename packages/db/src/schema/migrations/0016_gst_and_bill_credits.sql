CREATE TABLE "bill_credits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"lease_id" uuid NOT NULL,
	"utility_id" uuid,
	"owner_id" uuid NOT NULL,
	"type" text DEFAULT 'write_off' NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"credit_note_no" text NOT NULL,
	"applied_as" text DEFAULT 'adjust' NOT NULL,
	"reverses_credit_id" uuid,
	"reversed_at" timestamp,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bill_credits_credit_note_no_unique" UNIQUE("credit_note_no"),
	CONSTRAINT "bill_credits_amount_negative_check" CHECK ("bill_credits"."amount" < 0),
	CONSTRAINT "bill_credits_reason_length_check" CHECK (char_length("bill_credits"."reason") >= 10)
);
--> statement-breakpoint
ALTER TABLE "owner_profiles" ADD COLUMN "gst_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "owner_profiles" ADD COLUMN "gst_rate_rent" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "owner_profiles" ADD COLUMN "gst_rate_maintenance" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bill_credits" ADD CONSTRAINT "bill_credits_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_credits" ADD CONSTRAINT "bill_credits_utility_id_utilities_id_fk" FOREIGN KEY ("utility_id") REFERENCES "public"."utilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_credits" ADD CONSTRAINT "bill_credits_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_credits" ADD CONSTRAINT "bill_credits_reverses_credit_id_bill_credits_id_fk" FOREIGN KEY ("reverses_credit_id") REFERENCES "public"."bill_credits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_credits" ADD CONSTRAINT "bill_credits_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_profiles" ADD CONSTRAINT "owner_profiles_gst_rate_rent_check" CHECK ("owner_profiles"."gst_rate_rent" IN (0,5,12,18));--> statement-breakpoint
ALTER TABLE "owner_profiles" ADD CONSTRAINT "owner_profiles_gst_rate_maintenance_check" CHECK ("owner_profiles"."gst_rate_maintenance" IN (0,5,12,18));