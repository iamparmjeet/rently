# Handover — 2026-09-03 — model: GPT-5.6 Sol — branch: fix/ledger-integrity-2026-09-03

Reconciles the stale `feat/multi-unit-lease-agreements` notes (that work is already merged into `main` via `d716bd9`/`2250e3f`) and records the new ledger/lifecycle bugfix branch.

## Baseline
- Branch `fix/ledger-integrity-2026-09-03` cut from clean `main@2250e3f`; rollback tag `pre-ledger-integrity`.
- The multi-unit agreement expand (`0020`) and active-lease partial unique index (`0021`) are already in `main`. Docs previously describing them as "uncommitted" are now reconciled.

## Done
- Created the branch + rollback tag.
- Wrote `docs/Bug-2026-09-03-ledger-integrity.md` (Found/Repro/Plan) and added dated decisions for settlement idempotency keys + deferred period-aware rent.
- Confirmed all findings against `packages/api` (not `apps/server`, which is gone).

## In-progress
- S1 — Settlement integrity: idempotency-key columns + partial unique index (migration `0022`) on `payments` and `billCredits`; row-lock + revalidate on the tx path.

## Broken
- No current verification blocker.

## Avoid
- Do not commit, push, or deploy unverified slices.
- Do not make `leases.agreementId` / `payments.paymentGroupId` non-null (legacy writers + backfill pending).
- Do not add a `(utility_id) WHERE type='utility' AND amount>0` unique index — collides with void-then-repay.
- Period-aware rent is deferred to `feat/period-aware-rent`; do not implement it here.

## Next
1. S1 → S2 → S3 → S4 (money), S5 (lifecycle), S6 (auth), S7 (batch/housekeeping).
2. Verify each: `db:generate` (no drift, S1) → `check-types` → focused Biome → `db:migrate:test` (S1) → focused vitest.
3. Review full diff before any no-emoji commit; push only with approval.
