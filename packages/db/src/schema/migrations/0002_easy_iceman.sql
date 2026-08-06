CREATE TABLE "beta_access_codes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"grants_plan_slug" text DEFAULT 'pro' NOT NULL,
	"period_days" integer DEFAULT 365 NOT NULL,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"total_uses" integer DEFAULT 0 NOT NULL,
	"used_by_user_id" uuid,
	"used_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "beta_access_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_subscription_id_subscriptions_id_fk";
--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "period_start" SET DATA TYPE timestamp USING "period_start"::timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "period_end" SET DATA TYPE timestamp USING "period_end"::timestamp;--> statement-breakpoint
ALTER TABLE "plans" ALTER COLUMN "tenant_limit" SET DEFAULT 50;--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "status" SET DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "beta_access_codes" ADD CONSTRAINT "beta_access_codes_used_by_user_id_user_id_fk" FOREIGN KEY ("used_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_slug_unique" UNIQUE("slug");
