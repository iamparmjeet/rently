ALTER TABLE "tenant_invites" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_invites" ADD COLUMN "onboarding_mode" text DEFAULT 'tenant_completed' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_invites" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "tenant_invites" ADD COLUMN "emergency_contact_name" text;--> statement-breakpoint
ALTER TABLE "tenant_invites" ADD COLUMN "emergency_contact_location" text;--> statement-breakpoint
ALTER TABLE "tenant_invites" ADD COLUMN "delivery_status" text DEFAULT 'not_attempted' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_invites" ADD COLUMN "last_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "tenant_invites" ADD COLUMN "delivery_error_code" text;--> statement-breakpoint
ALTER TABLE "tenant_invites" ADD COLUMN "terms_accepted_at" timestamp;--> statement-breakpoint
ALTER TABLE "tenant_invites" ADD COLUMN "terms_version" text;--> statement-breakpoint
ALTER TABLE "tenant_invites" ADD COLUMN "privacy_acknowledged_at" timestamp;--> statement-breakpoint
ALTER TABLE "tenant_invites" ADD COLUMN "privacy_version" text;