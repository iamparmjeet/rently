ALTER TABLE "account" ALTER COLUMN "provider_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "tenant_invites" ALTER COLUMN "invited_by" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "tenant_profiles" ALTER COLUMN "verified_by" SET DATA TYPE uuid;