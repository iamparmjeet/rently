CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"payment_received" boolean DEFAULT true NOT NULL,
	"utility_bill_generated" boolean DEFAULT false NOT NULL,
	"lease_expiry_alert" boolean DEFAULT true NOT NULL,
	"rent_due_reminder" boolean DEFAULT true NOT NULL,
	"overdue_alert" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_owner_id_unique" UNIQUE("owner_id")
);
--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;