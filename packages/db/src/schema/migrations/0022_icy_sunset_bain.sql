ALTER TABLE "bill_credits" ADD COLUMN "idempotency_key" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "idempotency_key" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "bill_credits_lease_idempotency_key" ON "bill_credits" USING btree ("lease_id","idempotency_key") WHERE "bill_credits"."idempotency_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_lease_idempotency_key" ON "payments" USING btree ("lease_id","idempotency_key") WHERE "payments"."idempotency_key" is not null;