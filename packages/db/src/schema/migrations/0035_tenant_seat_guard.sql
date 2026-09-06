-- D04: enforce the plan tenant limit atomically when a distinct tenant
-- becomes active. Callers run this as the FIRST statement of the surrounding
-- node transaction / Neon batch: it takes a transaction-scoped advisory lock
-- (one key domain per owner, disjoint from rently:settlement:*), counts the
-- owner's distinct active tenants, and raises — aborting the whole
-- transaction/batch so no partial activation rows survive — when activating
-- the given tenant would exceed the plan limit.
--
-- The count excludes the activating tenant on purpose: a tenant who already
-- has an active lease under this owner consumes no additional seat
-- (multi-lease and combined-agreement activations are seat-neutral), and a
-- reactivation of an already-active tenant's lease is always allowed.
--
-- The limit is the owner's current plan's tenant_limit; the literal 10 is the
-- TENANT_LIMIT fallback used when the owner has no subscription row and must
-- stay in sync with packages/db/src/constants/payment-constants.ts.
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

	SELECT plans.tenant_limit INTO v_limit
	FROM subscriptions
	JOIN plans ON plans.id = subscriptions.plan_id
	WHERE subscriptions.user_id = p_owner_id
	ORDER BY subscriptions.created_at DESC
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
