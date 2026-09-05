ALTER TABLE "lease_agreements" ADD CONSTRAINT "lease_agreements_due_day_check" CHECK ("lease_agreements"."rent_due_date" is null or ("lease_agreements"."rent_due_date" >= 1 and "lease_agreements"."rent_due_date" <= 31));--> statement-breakpoint
ALTER TABLE "lease_agreements" ADD CONSTRAINT "lease_agreements_date_order_check" CHECK ("lease_agreements"."end_date" is null or "lease_agreements"."end_date" >= "lease_agreements"."start_date");--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_rent_check" CHECK ("leases"."rent" > 0);--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_deposit_check" CHECK ("leases"."deposit" is null or "leases"."deposit" >= 0);--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_due_day_check" CHECK ("leases"."rent_due_date" is null or ("leases"."rent_due_date" >= 1 and "leases"."rent_due_date" <= 31));--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_date_order_check" CHECK ("leases"."end_date" is null or "leases"."end_date" >= "leases"."start_date");--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_base_rent_check" CHECK ("units"."base_rent" > 0);--> statement-breakpoint
ALTER TABLE "utilities" ADD CONSTRAINT "utilities_fixed_charge_check" CHECK ("utilities"."fixed_charge" is null or "utilities"."fixed_charge" >= 0);--> statement-breakpoint
ALTER TABLE "utilities" ADD CONSTRAINT "utilities_rate_check" CHECK ("utilities"."rate_per_unit" is null or "utilities"."rate_per_unit" >= 0);--> statement-breakpoint
ALTER TABLE "utilities" ADD CONSTRAINT "utilities_readings_check" CHECK ("utilities"."previous_reading" >= 0 and "utilities"."current_reading" >= 0 and "utilities"."current_reading" >= "utilities"."previous_reading");--> statement-breakpoint
ALTER TABLE "utilities" ADD CONSTRAINT "utilities_period_order_check" CHECK ("utilities"."previous_reading_date" is null or "utilities"."previous_reading_date" <= "utilities"."reading_date");