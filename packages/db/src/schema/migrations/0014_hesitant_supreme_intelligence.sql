ALTER TABLE "utilities" ALTER COLUMN "units_used" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "payment_status" DROP DEFAULT;