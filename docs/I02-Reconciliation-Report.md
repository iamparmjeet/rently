# I02 Reconciliation Report

Date: 2026-09-16
Reviewer: GPT-5.6 Sol
Target: `integ/phase-a-baseline@43553a09`
Migration head: `0044_opposite_tony_stark.sql`
Dataset: local `rently_dev` (production-shaped non-production data)

## Automated Matrix

`packages/db/src/reconciliation.sql` checks payment and credit reversals,
refund pairs, payment groups, rent allocations, utility balances,
subscriptions, invoices, and beta-code redemptions. The same SQL is executed by
`packages/db/src/reconciliation.test.ts` against the disposable test database.

Clean test database: 21 hard checks passed; all discrepancies were zero.

Local production-shaped database after reseeding the public demo:

| Result | Count | Status |
| --- | ---: | --- |
| Hard checks with zero discrepancies | 19 | Pass |
| Historical refund credits without linked refund payments | 5 | Blocker |
| Stale utility `is_paid=false` with zero due | 1 | Needs owner-approved repair |
| Rent backfill source remainders | 2 / 2,710,000 paise | Needs owner decision |
| Legacy or compatibility ungrouped payments | 59 | Review inventory |
| Utility overpayments | 1 / 8,000 paise | Needs owner decision |

The three demo-owned stale utility flags found by the first run disappeared
after the seed began creating matching utility payments. No real-owner rows were
mutated. The seed's 47 rent payments and adjustment credit are now allocated by
the canonical rent-ledger writers; all 47 payment amounts are fully allocated.

## Blocking Historical Rows

Five negative credits with `applied_as='refund'` predate the linked refund
payment introduced by migration 0044. They have no `refund_payment_id`, so the
cash ledger cannot prove that money left the business. They require a separate
financial migration or explicit data repair that creates the missing immutable
negative payment rows and links them to the credits. This must not be folded
into the UI/seed rollup.

## Upgrade And Rollback

- Empty-install migration replay passes through 0044.
- No pre-remediation database dump exists in the repository or user workspace,
  so the required upgrade replay cannot be reproduced from an immutable source.
- Destructive historical migrations cannot be safely reversed with down SQL.
  Operational rollback is application rollback plus forward correction, or a
  database snapshot restore with reconciliation of writes after the snapshot.
- Exact historical beta entitlement and invoice tariff reconstruction is not
  possible because redemption and invoice rows do not snapshot every source
  input. Current structural/count invariants are covered by the matrix.

## Approval

Status: **BLOCKED**

I02 remains `[~]`. Before a `main` rollup:

1. Repair or explicitly reject the five unpaired refund credits in a dedicated
   financial slice.
2. Decide the two rent remainders, one stale utility flag, and one utility
   overpayment.
3. Supply a pre-remediation snapshot if upgrade replay is still required, or
   explicitly approve the documented inability to reproduce it.
