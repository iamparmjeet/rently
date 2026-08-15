CREATE TABLE "rent_reminder_suppressions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"lease_id" uuid NOT NULL,
	"period_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rent_reminder_suppressions_dedupe_key" UNIQUE("owner_id","lease_id","period_key")
);
--> statement-breakpoint
CREATE TABLE "scheduled_email_deliveries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"lease_id" uuid NOT NULL,
	"type" text NOT NULL,
	"period_key" text NOT NULL,
	"threshold_days" integer NOT NULL,
	"status" text DEFAULT 'claimed' NOT NULL,
	"attempted_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scheduled_email_deliveries_dedupe_key" UNIQUE("owner_id","lease_id","type","period_key","threshold_days")
);
--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "rent_due_lead_days" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "overdue_grace_days" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "rent_reminder_suppressions" ADD CONSTRAINT "rent_reminder_suppressions_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_reminder_suppressions" ADD CONSTRAINT "rent_reminder_suppressions_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_email_deliveries" ADD CONSTRAINT "scheduled_email_deliveries_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_email_deliveries" ADD CONSTRAINT "scheduled_email_deliveries_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_rent_due_lead_days_check" CHECK ("notification_preferences"."rent_due_lead_days" >= 0 AND "notification_preferences"."rent_due_lead_days" <= 14);--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_overdue_grace_days_check" CHECK ("notification_preferences"."overdue_grace_days" >= 1 AND "notification_preferences"."overdue_grace_days" <= 31);