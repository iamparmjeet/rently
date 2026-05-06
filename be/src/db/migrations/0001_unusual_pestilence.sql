CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text,
	"owner_id" text,
	"amount" real NOT NULL,
	"currency" text DEFAULT 'inr',
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"payment_status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"tenant_limit" integer DEFAULT 500 NOT NULL,
	"price_monthly" real DEFAULT 0 NOT NULL,
	"price_quarterly" real DEFAULT 0 NOT NULL,
	"price_half_yearly" real DEFAULT 0 NOT NULL,
	"price_yearly" real DEFAULT 0 NOT NULL,
	"price_two_year" real DEFAULT 0 NOT NULL,
	"discount_quarterly" real DEFAULT 0.05,
	"discount_half_yearly" real DEFAULT 0.1,
	"discount_yearly" real DEFAULT 0.15,
	"discount_two_year" real DEFAULT 0.2,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"status" text DEFAULT 'trial',
	"current_period_start" timestamp DEFAULT now(),
	"current_period_end" timestamp,
	"trial_ends_at" timestamp,
	"billing_interval" text DEFAULT 'monthly' NOT NULL,
	"next_billing_date" timestamp,
	"total_paid" real DEFAULT 0,
	"currency" text DEFAULT 'inr',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;