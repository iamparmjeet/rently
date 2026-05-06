CREATE TABLE "owner_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"company_name" text NOT NULL,
	"address" text,
	"gst_number" text,
	"subscription_id" text
);
--> statement-breakpoint
CREATE TABLE "tenant_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"uid_number" text,
	"emergency_contact" text,
	"address" text,
	"url" text,
	CONSTRAINT "tenant_profiles_uid_number_unique" UNIQUE("uid_number")
);
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'owner';--> statement-breakpoint
ALTER TABLE "owner_profiles" ADD CONSTRAINT "owner_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_profiles" ADD CONSTRAINT "owner_profiles_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_profiles" ADD CONSTRAINT "tenant_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;