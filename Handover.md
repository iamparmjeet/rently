# Handover — 2026-09-03 — model: GPT-5.6 Sol — branch: fix/ledger-integrity-2026-09-03

Reconciles the stale `feat/multi-unit-lease-agreements` notes (that work is already merged into `main` via `d716bd9`/`2250e3f`) and records the new ledger/lifecycle bugfix branch.

## Baseline
- Branch `fix/ledger-integrity-2026-09-03` cut from clean `main@2250e3f`; rollback tag `pre-ledger-integrity`.
- The multi-unit agreement expand (`0020`) and active-lease partial unique index (`0021`) are already in `main`. Docs previously describing them as "uncommitted" are now reconciled.

## Done
- Created the branch + rollback tag.
- Wrote `docs/Bug-2026-09-03-ledger-integrity.md` (Found/Repro/Plan) and added dated decisions for settlement idempotency keys + deferred period-aware rent.
- Confirmed all findings against `packages/api` (not `apps/server`, which is gone).
- Completed and committed S1–S7 (`443cbca` through `134ba50`); `bun run db:generate`, `db:migrate:test`, `check-types`, Biome, Vitest (151 tests), and the full build passed.
- Added `db:refresh:local` to restore a Neon dump into Docker-only `rently_dev`; `dev:server:local-db` forces the local node-postgres path.
- Added guarded `db:migrate:local`; it rejects any target except `localhost/rently_dev`.
- Added `db:seed:local`; do not use the production-targeted `db:seed` while working locally.
- `bun run dev` now forces local `rently_dev`; it is safe for the normal all-app development flow.
- Simplified database selection so `DATABASE_URL` is the only selector: Docker URLs use node-postgres and Neon hostnames use Neon HTTP. Removed `USE_NEON` and `RENTLY_LOCAL_DATABASE_URL`.
- Reproduced the ₹1,200 payment failure independently of database routing. PostgreSQL returns `SUM(integer)` as a string, so `120000 + "0"` became `1200000`. `credit.helpers.ts` now converts aggregates to numbers and rent due counts only rent payments plus their reversals, excluding deposits/other payments. Added a focused regression covering the exact amount, voided ₹12,000 payment, and unrelated deposit.
- Updated the payments page so voiding either allocation of a combined payment calls `voidPaymentGroup`, creates reversals for every allocation, and explains that behavior in the confirmation dialog. The existing grouped create/void integration test passes.
- Standardized all site currency display on `formatRupees`, which always shows two decimal places; removed `formatRupeesOptionalPaise`.

## In-progress
- Restore production-shaped data into local `rently_dev` and manually test the branch before opening a PR.
- Updated the dashboard Payments summary (uncommitted): Collection health is month-scoped net payment activity and All time is all-time net payment activity. Both include signed payment reversals. Utility payment rows already equal the discounted amount due, so bill credits are not subtracted a second time. A separate Net discounts card reports discount credits (with reversals netted) without changing collection totals. Focused helper tests, dashboard type checking, and Biome pass.
- Wired tenant meter readings for combined agreements (uncommitted): the readings tab selects an active unit, sends its `leaseId`, and scopes its prior-reading estimate/history to that unit. This resolves the API's required multi-unit lease selection.
- Repeat the ₹1,200 UI check against the user's original lease `01a06bc0-94b6-7cae-b040-347a98e52cc1` after restarting their dev process. That lease is absent from the currently inspectable `rently_dev` and configured Neon databases. An equivalent disposable local lease was exercised through the real dashboard/API: ₹1,200 recorded successfully and displayed as ₹1,200; the fixture and payment were then removed.
- Awaiting user confirmation before changing financial records: payment group `b9a5de70-bbc7-4522-a020-ee09e5cff84d` contains two erroneous ₹15,000 rent allocations for Shivam Dubey, on U-103 and U-104. Each lease rent is ₹1,500. Void the group once through the supported UI/API, then record the real received amount (normally ₹3,000 total / ₹1,500 per unit if both rents were paid). Do not delete ledger rows directly.

## Broken
- Migration `0022` was accidentally applied to production Neon during verification. It is additive only: nullable idempotency-key columns and partial unique indexes; leave it in place so the later deployment skips it safely.

## Avoid
- Do not commit, push, or deploy unverified slices.
- Do not make `leases.agreementId` / `payments.paymentGroupId` non-null (legacy writers + backfill pending).
- Do not add a `(utility_id) WHERE type='utility' AND amount>0` unique index — collides with void-then-repay.
- Period-aware rent is deferred to `feat/period-aware-rent`; do not implement it here.
- Do not point local development at production Neon. Use `db:refresh:local`; validate Neon HTTP batching only against a separate Neon branch.

## Next
1. With user approval, void Shivam's erroneous combined payment once and re-record the correct received amount.
2. Restart `bun run dev` and repeat the ₹1,200 payment against the user's original lease if desired.
3. If production-shaped data is still needed locally, refresh `rently_dev` with `SOURCE_DATABASE_URL="$(grep '^DATABASE_URL=' apps/server/.env | cut -d= -f2-)" bun run db:refresh:local`.
4. Use a Neon branch, never production, for Neon HTTP batch smoke coverage.
5. Commit/push only with user approval.
