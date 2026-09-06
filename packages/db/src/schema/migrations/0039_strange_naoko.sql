-- F02: notification identity is (user, type, entity, period) — never
-- isRead. Repair first: the old unread-only dedupe let a read notification
-- be recreated on the next poll (production-shaped dev data holds one such
-- pair). Keep the earliest row per identity, then constrain.
DELETE FROM "notifications" a
WHERE a."entity_id" IS NOT NULL
	AND a."entity_type" IS NOT NULL
	AND EXISTS (
		SELECT 1 FROM "notifications" b
		WHERE b."user_id" = a."user_id"
			AND b."type" = a."type"
			AND b."entity_id" = a."entity_id"
			AND b."entity_type" = a."entity_type"
			AND (b."created_at", b."id") < (a."created_at", a."id")
	);
--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedupe_key" ON "notifications" USING btree ("user_id","type","entity_id","entity_type") WHERE "notifications"."entity_id" is not null and "notifications"."entity_type" is not null;
