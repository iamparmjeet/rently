ALTER TABLE "invoices" ALTER COLUMN "period_start" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "period_end" SET DEFAULT now();