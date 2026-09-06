-- E04: normalize stored blank GSTINs (the API used to persist "" verbatim)
-- so the presence CHECK below holds on pre-existing rows.
UPDATE "owner_profiles" SET "gst_number" = NULL WHERE btrim("gst_number") = '';
--> statement-breakpoint
ALTER TABLE "owner_profiles" ADD CONSTRAINT "owner_profiles_gst_enabled_check" CHECK ("owner_profiles"."gst_enabled" = false OR ("owner_profiles"."gst_number" IS NOT NULL AND "owner_profiles"."gst_number" <> ''));