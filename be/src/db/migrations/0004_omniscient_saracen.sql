ALTER TABLE "leases" DROP CONSTRAINT "leases_unit_id_units_id_fk";
--> statement-breakpoint
ALTER TABLE "leases" DROP CONSTRAINT "leases_tenant_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "owner_profiles" DROP CONSTRAINT "owner_profiles_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_lease_id_leases_id_fk";
--> statement-breakpoint
ALTER TABLE "properties" DROP CONSTRAINT "properties_owner_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "referrers" DROP CONSTRAINT "referrers_referred_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "tenant_profiles" DROP CONSTRAINT "tenant_profiles_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "units" DROP CONSTRAINT "units_property_id_properties_id_fk";
--> statement-breakpoint
ALTER TABLE "utilities" DROP CONSTRAINT "utilities_lease_id_leases_id_fk";
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "expired" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_tenant_id_user_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_profiles" ADD CONSTRAINT "owner_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrers" ADD CONSTRAINT "referrers_referred_user_id_user_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_profiles" ADD CONSTRAINT "tenant_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utilities" ADD CONSTRAINT "utilities_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE cascade ON UPDATE no action;