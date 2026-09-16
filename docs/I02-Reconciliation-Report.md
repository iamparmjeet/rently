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

The hard matrix now has 25 named checks. The I02 hardening adds row-level
reversal-group membership (`G4`), rent-payment allocation conservation (`R6`),
orphan refund payments (`C5`), and positive refund-credit reversal linkage
(`C6`). Each has a transactional corrupt-fixture regression test; fixtures are
rolled back and never alter the shared audit dataset.

Clean test database: 25 hard checks passed; all discrepancies were zero.

Local production-shaped database after reseeding the public demo:

| Result | Count | Status |
| --- | ---: | --- |
| Pre-hardening hard checks with zero discrepancies | 19 / 21 | Pass |
| Historical refund credits without linked refund payments | 5 | Blocker |
| Stale utility `is_paid=false` with zero due | 1 | Needs owner-approved repair |
| Rent backfill source remainders | 2 / 2,710,000 paise | Needs owner decision |
| Legacy or compatibility ungrouped payments | 59 | Review inventory |
| Utility overpayments | 1 / 8,000 paise | Needs owner decision |

The three demo-owned stale utility flags found by the first run disappeared
after the seed began creating matching utility payments. No real-owner rows were
mutated. The seed's 47 rent payments and adjustment credit are now allocated by
the canonical rent-ledger writers; all 47 payment amounts are fully allocated.

The production-shaped tally above is the original 21-check audit. Re-running
the expanded 25-check matrix against that dataset is deliberately out of scope
for this audit-hardening slice; it would be read-only work in a future I02
review and cannot change the existing blocked status.

## Blocking Historical Rows

Five negative credits with `applied_as='refund'` predate the linked refund
payment introduced by migration 0044. Follow-up inspection found that each is
attached to an unpaid utility bill and functions as a bill reduction; none has
a linked refund payment or evidence that cash left the business. They are not
public-demo seed rows.

The approved remediation shape for this exact set is a targeted
reclassification from `refund` to `adjust`, not deletion and not creation of
cash-payment rows. Before production execution, an operator must take a Neon
restore point, run a read-only manifest that proves the exact five rows still
match (negative amount, utility attached, no `refund_payment_id`, no credit
reversal, and unpaid utility), then perform the reclassification in one
transaction and rerun the reconciliation matrix. If any row no longer matches
that manifest, stop: it may be a genuine cash refund and needs a linked refund
payment instead. This is a dedicated financial data-repair slice and must not
be folded into the UI or demo-seed rollup.

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

## Owner Decision: Fresh Production Start

On 2026-09-16, the owner chose to retire the current production data and start
again with a clean workspace. This supersedes row-by-row remediation of the
five refund-labelled credits, rent remainders, stale utility state,
overpayment, and ungrouped-payment inventory; those findings describe the
retired dataset and must not be copied into the new one.

Before the reset, take and retain a Neon restore point or export, verify that
it can be restored, and record the reset time. Do not delete tables or rows
until that recovery artifact exists. After recreating the workspace, rerun the
full reconciliation matrix against the fresh data and retain its passing
result. The reset removes the need to repair the retired rows; it does not
waive the application, migration, or reconciliation verification gates.

## Approval

Status: **BLOCKED**

I02 remains `[~]` until the production reset is complete and the fresh dataset
has a clean reconciliation result. Before a `main` rollup:

1. Take and verify the recovery artifact for the retired dataset, then reset
   the production workspace.
2. Recreate only the intended fresh records and run the complete hard-check
   matrix with zero discrepancies.
3. Verify deployment migrations and rollback from the new clean baseline.
