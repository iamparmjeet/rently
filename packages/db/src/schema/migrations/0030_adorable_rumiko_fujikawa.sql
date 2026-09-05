ALTER TABLE "payment_groups" ADD COLUMN "idempotency_key" uuid;--> statement-breakpoint
ALTER TABLE "payment_groups" ADD COLUMN "request_fingerprint" text;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_groups_agreement_idempotency_key" ON "payment_groups" USING btree ("agreement_id","idempotency_key") WHERE "payment_groups"."idempotency_key" is not null;