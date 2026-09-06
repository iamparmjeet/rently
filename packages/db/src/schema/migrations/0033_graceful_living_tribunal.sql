DELETE FROM "subscriptions" AS "dup"
USING "subscriptions" AS "keep"
WHERE "dup"."user_id" = "keep"."user_id"
	AND "dup"."id" <> "keep"."id"
	AND (
		"keep"."created_at" > "dup"."created_at"
		OR (
			"keep"."created_at" = "dup"."created_at"
			AND "keep"."id" > "dup"."id"
		)
	);--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_user_id_unique" ON "subscriptions" USING btree ("user_id");
