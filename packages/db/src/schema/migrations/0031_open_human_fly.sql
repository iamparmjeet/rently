CREATE TABLE "rent_allocations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"charge_id" uuid NOT NULL,
	"payment_id" uuid,
	"credit_id" uuid,
	"amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rent_allocations_exactly_one_source" CHECK (("rent_allocations"."payment_id" is null) <> ("rent_allocations"."credit_id" is null)),
	CONSTRAINT "rent_allocations_amount_nonzero" CHECK ("rent_allocations"."amount" <> 0)
);
--> statement-breakpoint
CREATE TABLE "rent_charges" (
	"id" uuid PRIMARY KEY NOT NULL,
	"lease_id" uuid NOT NULL,
	"period_key" text NOT NULL,
	"due_date" date NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rent_charges_amount_positive" CHECK ("rent_charges"."amount" > 0),
	CONSTRAINT "rent_charges_period_key_format" CHECK ("rent_charges"."period_key" ~ '^[0-9]{4}-[0-9]{2}$'),
	CONSTRAINT "rent_charges_due_date_in_period" CHECK ("rent_charges"."due_date"::text like "rent_charges"."period_key" || '-%')
);
--> statement-breakpoint
ALTER TABLE "rent_allocations" ADD CONSTRAINT "rent_allocations_charge_id_rent_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."rent_charges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_allocations" ADD CONSTRAINT "rent_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_allocations" ADD CONSTRAINT "rent_allocations_credit_id_bill_credits_id_fk" FOREIGN KEY ("credit_id") REFERENCES "public"."bill_credits"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_charges" ADD CONSTRAINT "rent_charges_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rent_allocations_payment_charge_unique" ON "rent_allocations" USING btree ("payment_id","charge_id") WHERE "rent_allocations"."payment_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "rent_allocations_credit_charge_unique" ON "rent_allocations" USING btree ("credit_id","charge_id") WHERE "rent_allocations"."credit_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "rent_charges_lease_period_unique" ON "rent_charges" USING btree ("lease_id","period_key");