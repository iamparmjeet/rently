ALTER TABLE "leases" ADD COLUMN "notice" numeric;--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "rent-due-date" timestamp;--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "year-built" numeric;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "total-area" numeric;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "floors" numeric;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "description" text;