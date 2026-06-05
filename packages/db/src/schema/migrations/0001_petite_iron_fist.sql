ALTER TABLE "leases" RENAME COLUMN "rent-due-date" TO "rent_due_date";--> statement-breakpoint
ALTER TABLE "properties" RENAME COLUMN "year-built" TO "year_built";--> statement-breakpoint
ALTER TABLE "properties" RENAME COLUMN "total-area" TO "total_area";--> statement-breakpoint
ALTER TABLE "tenant_profiles" RENAME COLUMN "profile_iamge" TO "image";--> statement-breakpoint
ALTER TABLE "tenant_profiles" RENAME COLUMN "verfication_notes" TO "verification_notes";--> statement-breakpoint
ALTER TABLE "units" ALTER COLUMN "furnishing" SET DEFAULT 'unfurnished';--> statement-breakpoint
ALTER TABLE "plans" ALTER COLUMN "discount_quarterly" SET DEFAULT 500;--> statement-breakpoint
ALTER TABLE "plans" ALTER COLUMN "discount_half_yearly" SET DEFAULT 100;--> statement-breakpoint
ALTER TABLE "plans" ALTER COLUMN "discount_yearly" SET DEFAULT 150;--> statement-breakpoint
ALTER TABLE "plans" ALTER COLUMN "discount_two_year" SET DEFAULT 200;