-- Refuse to hide a legacy lifecycle inconsistency. Operators must resolve
-- duplicate active leases explicitly before the database can enforce the rule.
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "leases"
		WHERE "status" = 'active'
		GROUP BY "unit_id"
		HAVING COUNT(*) > 1
	) THEN
		RAISE EXCEPTION 'cannot enforce one active lease per unit: duplicate active leases exist';
	END IF;
END
$$;
--> statement-breakpoint
CREATE UNIQUE INDEX "leases_one_active_per_unit_key" ON "leases" USING btree ("unit_id") WHERE "leases"."status" = 'active';
