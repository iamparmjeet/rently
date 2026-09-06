-- D07: close expired pending rows before enforcing the normalized owner/email
-- uniqueness rule. Older duplicate rows are retained as expired audit records.
UPDATE "tenant_invites"
SET "status" = 'expired', "updated_at" = now()
WHERE "status" = 'pending'
	AND "deleted_at" IS NULL
	AND "expires_at" IS NOT NULL
	AND "expires_at" <= now();

WITH ranked AS (
	SELECT
		"id",
		row_number() OVER (
			PARTITION BY "invited_by", lower("email")
			ORDER BY "created_at" DESC, "id" DESC
		) AS "rank"
	FROM "tenant_invites"
	WHERE "status" = 'pending' AND "deleted_at" IS NULL
)
UPDATE "tenant_invites" AS invites
SET "status" = 'expired', "updated_at" = now()
FROM ranked
WHERE invites."id" = ranked."id" AND ranked."rank" > 1;

CREATE UNIQUE INDEX "tenant_invites_pending_owner_email_unique"
ON "tenant_invites" USING btree ("invited_by", lower("email"))
WHERE "tenant_invites"."status" = 'pending'
	AND "tenant_invites"."deleted_at" IS NULL;

-- The advisory lock makes the quota check and invite insert one serialized
-- operation for each owner in both node-postgres transactions and Neon batches.
CREATE OR REPLACE FUNCTION rently_assert_pending_invite_quota(p_owner_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
	v_limit integer;
	v_pending integer;
BEGIN
	PERFORM pg_advisory_xact_lock(
		hashtextextended('rently:pending-invite-limit:' || p_owner_id::text, 0)
	);

	SELECT plans.tenant_limit INTO v_limit
	FROM subscriptions
	JOIN plans ON plans.id = subscriptions.plan_id
	WHERE subscriptions.user_id = p_owner_id
	ORDER BY subscriptions.created_at DESC
	LIMIT 1;

	SELECT count(*)::int INTO v_pending
	FROM tenant_invites
	WHERE invited_by = p_owner_id
		AND status = 'pending'
		AND deleted_at IS NULL
		AND (expires_at IS NULL OR expires_at > now());

	IF v_pending >= coalesce(v_limit, 10) THEN
		RAISE EXCEPTION 'PENDING_INVITE_LIMIT_REACHED'
			USING ERRCODE = 'P0341';
	END IF;
END;
$$;
