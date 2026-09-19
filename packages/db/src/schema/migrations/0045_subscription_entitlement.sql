-- Subscription entitlement enforcement: the D04 seat guard and the D07
-- pending-invite quota read the plan limit from the owner's latest
-- subscription, but they ignored the subscription's lifecycle. A cancelled or
-- lapsed subscription kept granting its full tenant limit, so any pause/cancel
-- control would have been a dead button.
--
-- Entitlement is TIME-based, not status-based: a subscription grants its plan
-- limit while it has not been flagged `expired` AND its paid period has not
-- lapsed (`current_period_end` is null or still in the future). Cancellation
-- keeps `current_period_end`, so access survives to the end of the paid period
-- and lapses afterwards. `subscriptions.current_period_end` is a zone-less
-- `timestamp` holding UTC wall clock, so compare against `now() at time zone
-- 'utc'` — the same convention D03 uses for renewal math.
--
-- A lapsed subscription yields a limit of 0, which makes `v_active >= 0` true
-- and raises the existing refusal code. An owner with NO subscription row
-- still falls back to the literal 10 (TENANT_LIMIT in
-- packages/db/src/constants/payment-constants.ts), preserving first-run
-- onboarding. The TypeScript read in routers/helpers/tenant-limit.ts mirrors
-- these predicates; this SQL arbiter stays authoritative.
CREATE OR REPLACE FUNCTION rently_assert_tenant_seat(p_owner_id uuid, p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
	v_limit integer;
	v_active integer;
BEGIN
	PERFORM pg_advisory_xact_lock(
		hashtextextended('rently:tenant-limit:' || p_owner_id::text, 0)
	);

	SELECT
		CASE
			WHEN s."expired" IS NOT TRUE
				AND (
					s."current_period_end" IS NULL
					OR s."current_period_end" > (now() AT TIME ZONE 'utc')
				)
			THEN plans.tenant_limit
			ELSE 0
		END INTO v_limit
	FROM subscriptions s
	JOIN plans ON plans.id = s.plan_id
	WHERE s.user_id = p_owner_id
	ORDER BY s.created_at DESC, s.id DESC
	LIMIT 1;

	SELECT count(DISTINCT l.tenant_id)::int INTO v_active
	FROM leases l
	JOIN units u ON u.id = l.unit_id
	JOIN properties p ON p.id = u.property_id
	WHERE p.owner_id = p_owner_id
		AND l.status = 'active'
		AND l.tenant_id <> p_tenant_id;

	IF v_active >= coalesce(v_limit, 10) THEN
		RAISE EXCEPTION 'TENANT_PLAN_LIMIT_REACHED'
			USING ERRCODE = 'P0340';
	END IF;
END;
$$;

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

	SELECT
		CASE
			WHEN s."expired" IS NOT TRUE
				AND (
					s."current_period_end" IS NULL
					OR s."current_period_end" > (now() AT TIME ZONE 'utc')
				)
			THEN plans.tenant_limit
			ELSE 0
		END INTO v_limit
	FROM subscriptions s
	JOIN plans ON plans.id = s.plan_id
	WHERE s.user_id = p_owner_id
	ORDER BY s.created_at DESC, s.id DESC
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
