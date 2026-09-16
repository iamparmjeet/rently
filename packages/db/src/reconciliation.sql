WITH checks AS (
  SELECT 'P1 payment reversal pairing' AS check_name, 'hard' AS severity, count(*)::bigint AS discrepancy_count
  FROM payments r
  LEFT JOIN payments o ON o.id = r.reverses_payment_id
  WHERE r.type = 'reversal'
    AND (
      o.id IS NULL OR o.type = 'reversal' OR r.lease_id <> o.lease_id
      OR r.utility_id IS DISTINCT FROM o.utility_id OR r.amount <> -o.amount
    )

  UNION ALL
  SELECT 'P2 payment signs', 'hard', count(*)
  FROM payments
  WHERE (type IN ('rent', 'utility', 'deposit', 'other') AND amount <= 0)
    OR (type = 'refund' AND amount >= 0)
    OR amount = 0

  UNION ALL
  SELECT 'P3 payment reversal cardinality', 'hard', count(*)
  FROM (
    SELECT reverses_payment_id
    FROM payments
    WHERE reverses_payment_id IS NOT NULL
    GROUP BY reverses_payment_id
    HAVING count(*) <> 1
  ) invalid

  UNION ALL
  SELECT 'C1 credit reversal pairing', 'hard', count(*)
  FROM bill_credits r
  LEFT JOIN bill_credits o ON o.id = r.reverses_credit_id
  WHERE r.reverses_credit_id IS NOT NULL
    AND (
      o.id IS NULL OR o.amount >= 0 OR r.amount <> -o.amount
      OR r.lease_id <> o.lease_id OR r.utility_id IS DISTINCT FROM o.utility_id
      OR r.type <> o.type OR r.applied_as <> o.applied_as
      OR r.refund_payment_id IS NOT NULL
    )

  UNION ALL
  SELECT 'C2 credit reversal state', 'hard', count(*)
  FROM bill_credits o
  WHERE o.amount < 0
    AND ((o.reversed_at IS NOT NULL) IS DISTINCT FROM EXISTS (
      SELECT 1 FROM bill_credits r WHERE r.reverses_credit_id = o.id
    ))

  UNION ALL
  SELECT 'C3 cash refund pairing', 'hard', count(*)
  FROM bill_credits c
  LEFT JOIN payments p ON p.id = c.refund_payment_id
  WHERE c.amount < 0
    AND (
      (
        c.applied_as = 'refund'
        AND (
          p.id IS NULL OR p.type <> 'refund' OR p.amount <> c.amount
          OR p.lease_id <> c.lease_id OR p.utility_id IS DISTINCT FROM c.utility_id
        )
      )
      OR (c.applied_as <> 'refund' AND c.refund_payment_id IS NOT NULL)
    )

  UNION ALL
  SELECT 'C4 refund recovery pairing', 'hard', count(*)
  FROM bill_credits c
  WHERE c.amount < 0 AND c.applied_as = 'refund' AND c.reversed_at IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM payments r
      WHERE r.reverses_payment_id = c.refund_payment_id
        AND r.type = 'reversal'
        AND r.amount = -c.amount
    )

  UNION ALL
  SELECT 'G1 empty payment groups', 'hard', count(*)
  FROM payment_groups g
  WHERE NOT EXISTS (SELECT 1 FROM payments p WHERE p.payment_group_id = g.id)

  UNION ALL
  SELECT 'G2 grouped payment agreement scope', 'hard', count(*)
  FROM payments p
  JOIN leases l ON l.id = p.lease_id
  JOIN payment_groups g ON g.id = p.payment_group_id
  WHERE l.agreement_id IS DISTINCT FROM g.agreement_id

  UNION ALL
  SELECT 'G3 reversal group totals', 'hard', count(*)
  FROM payment_groups rg
  JOIN payment_groups og ON og.id = rg.reverses_payment_group_id
  CROSS JOIN LATERAL (
    SELECT coalesce(sum(amount), 0) AS total FROM payments WHERE payment_group_id = rg.id
  ) reversal_total
  CROSS JOIN LATERAL (
    SELECT coalesce(sum(amount), 0) AS total FROM payments WHERE payment_group_id = og.id
  ) original_total
  WHERE reversal_total.total <> -original_total.total

  UNION ALL
  SELECT 'R1 allocation provenance', 'hard', count(*)
  FROM rent_allocations a
  JOIN rent_charges c ON c.id = a.charge_id
  LEFT JOIN payments p ON p.id = a.payment_id
  LEFT JOIN payments original_payment ON original_payment.id = p.reverses_payment_id
  LEFT JOIN bill_credits credit ON credit.id = a.credit_id
  WHERE (
    a.payment_id IS NOT NULL
    AND (
      p.lease_id <> c.lease_id
      OR NOT (p.type = 'rent' OR (p.type = 'reversal' AND original_payment.type = 'rent'))
    )
  ) OR (
    a.credit_id IS NOT NULL
    AND (credit.lease_id <> c.lease_id OR credit.utility_id IS NOT NULL)
  )

  UNION ALL
  SELECT 'R2 charge capacity', 'hard', count(*)
  FROM (
    SELECT c.id
    FROM rent_charges c
    LEFT JOIN rent_allocations a ON a.charge_id = c.id
    GROUP BY c.id, c.amount
    HAVING coalesce(sum(a.amount), 0) > c.amount
  ) invalid

  UNION ALL
  SELECT 'R3 payment allocation mirrors', 'hard', count(*)
  FROM payments reversal
  JOIN payments original ON original.id = reversal.reverses_payment_id
  JOIN rent_allocations original_allocation ON original_allocation.payment_id = original.id
  LEFT JOIN rent_allocations reversal_allocation
    ON reversal_allocation.payment_id = reversal.id
    AND reversal_allocation.charge_id = original_allocation.charge_id
    AND reversal_allocation.amount = -original_allocation.amount
  WHERE reversal.type = 'reversal' AND reversal_allocation.id IS NULL

  UNION ALL
  SELECT 'R4 credit allocation mirrors', 'hard', count(*)
  FROM bill_credits reversal
  JOIN bill_credits original ON original.id = reversal.reverses_credit_id
  JOIN rent_allocations original_allocation ON original_allocation.credit_id = original.id
  LEFT JOIN rent_allocations reversal_allocation
    ON reversal_allocation.credit_id = reversal.id
    AND reversal_allocation.charge_id = original_allocation.charge_id
    AND reversal_allocation.amount = -original_allocation.amount
  WHERE reversal_allocation.id IS NULL

  UNION ALL
  SELECT 'R5 adjustment credit completeness', 'hard', count(*)
  FROM bill_credits credit
  WHERE credit.utility_id IS NULL
    AND credit.applied_as = 'adjust'
    AND coalesce((
      SELECT sum(allocation.amount)
      FROM rent_allocations allocation
      WHERE allocation.credit_id = credit.id
    ), 0) <> -credit.amount

  UNION ALL
  SELECT 'U1 utility paid state', 'hard', count(*)
  FROM (
    SELECT
      u.id,
      u.is_paid,
      u.total_amount
        + coalesce((SELECT sum(c.amount) FROM bill_credits c WHERE c.utility_id = u.id), 0)
        - coalesce((
          SELECT sum(
            CASE
              WHEN p.type = 'utility' THEN p.amount
              WHEN p.type = 'reversal' AND original.type = 'utility' THEN p.amount
              ELSE 0
            END
          )
          FROM payments p
          LEFT JOIN payments original ON original.id = p.reverses_payment_id
          WHERE p.utility_id = u.id
        ), 0) AS due
    FROM utilities u
  ) utility_balance
  WHERE utility_balance.is_paid IS DISTINCT FROM (utility_balance.due <= 0)

  UNION ALL
  SELECT 'U2 utility ledger scope', 'hard', count(*)
  FROM utilities u
  LEFT JOIN payments p ON p.utility_id = u.id
  LEFT JOIN bill_credits c ON c.utility_id = u.id
  WHERE (p.id IS NOT NULL AND p.lease_id <> u.lease_id)
    OR (c.id IS NOT NULL AND c.lease_id <> u.lease_id)

  UNION ALL
  SELECT 'S1 paid invoice truth', 'hard', count(*)
  FROM invoices i
  LEFT JOIN subscriptions s ON s.id = i.subscription_id
  WHERE i.payment_status = 'paid'
    AND (
      s.id IS NULL OR i.user_id <> s.user_id OR i.amount <= 0
      OR i.period_start >= i.period_end OR i.paid_at IS NULL
      OR i.payment_method IS NULL OR i.external_payment_reference IS NULL
      OR i.recorded_by_admin_user_id IS NULL
    )

  UNION ALL
  SELECT 'S2 subscription total paid', 'hard', count(*)
  FROM (
    SELECT
      s.id,
      s.total_paid,
      coalesce(sum(i.amount) FILTER (WHERE i.payment_status = 'paid'), 0) AS invoice_total
    FROM subscriptions s
    LEFT JOIN invoices i ON i.subscription_id = s.id
    GROUP BY s.id, s.total_paid
  ) totals
  WHERE coalesce(totals.total_paid, 0) <> totals.invoice_total

  UNION ALL
  SELECT 'S3 paid invoice overlap', 'hard', count(*)
  FROM invoices a
  JOIN invoices b ON a.subscription_id = b.subscription_id AND a.id < b.id
  WHERE a.payment_status = 'paid' AND b.payment_status = 'paid'
    AND tstzrange(a.period_start, a.period_end, '[)')
      && tstzrange(b.period_start, b.period_end, '[)')

  UNION ALL
  SELECT 'S4 beta redemption counts', 'hard', count(*)
  FROM (
    SELECT
      code.id,
      code.total_uses,
      code.max_uses,
      count(redemption.id) AS actual_uses,
      plan.id AS plan_id
    FROM beta_access_codes code
    LEFT JOIN beta_code_redemptions redemption ON redemption.code_id = code.id
    LEFT JOIN plans plan ON plan.slug = code.grants_plan_slug
    GROUP BY code.id, code.total_uses, code.max_uses, plan.id
  ) redemption_totals
  WHERE redemption_totals.total_uses <> redemption_totals.actual_uses
    OR redemption_totals.total_uses < 0
    OR redemption_totals.total_uses > redemption_totals.max_uses
    OR redemption_totals.plan_id IS NULL

  UNION ALL
  SELECT 'review: ungrouped payments', 'review', count(*)
  FROM payments
  WHERE payment_group_id IS NULL

  UNION ALL
  SELECT 'review: rent backfill exceptions', 'review', count(*)
  FROM rent_backfill_exceptions

  UNION ALL
  SELECT 'review: utility overpayments', 'review', count(*)
  FROM (
    SELECT
      u.id,
      u.total_amount
        + coalesce((SELECT sum(c.amount) FROM bill_credits c WHERE c.utility_id = u.id), 0)
        - coalesce((
          SELECT sum(
            CASE
              WHEN p.type = 'utility' THEN p.amount
              WHEN p.type = 'reversal' AND original.type = 'utility' THEN p.amount
              ELSE 0
            END
          )
          FROM payments p
          LEFT JOIN payments original ON original.id = p.reverses_payment_id
          WHERE p.utility_id = u.id
        ), 0) AS due
    FROM utilities u
  ) utility_balance
  WHERE utility_balance.due < 0
)
SELECT check_name, severity, discrepancy_count
FROM checks
ORDER BY severity, check_name;
