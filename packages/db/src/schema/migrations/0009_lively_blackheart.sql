ALTER TABLE "document_update_requests" ALTER COLUMN "requested_by_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "document_update_requests" ALTER COLUMN "reviewed_by_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "owner_profiles" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "referrers" ALTER COLUMN "referred_user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "tenant_profiles" ALTER COLUMN "verified_by" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "tenant_profiles" ALTER COLUMN "created_by" SET DATA TYPE text;