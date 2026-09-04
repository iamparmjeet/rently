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

## In-progress
- Restore production-shaped data into local `rently_dev` and manually test the branch before opening a PR.

## Broken
- Migration `0022` was accidentally applied to production Neon during verification. It is additive only: nullable idempotency-key columns and partial unique indexes; leave it in place so the later deployment skips it safely.

## Avoid
- Do not commit, push, or deploy unverified slices.
- Do not make `leases.agreementId` / `payments.paymentGroupId` non-null (legacy writers + backfill pending).
- Do not add a `(utility_id) WHERE type='utility' AND amount>0` unique index — collides with void-then-repay.
- Period-aware rent is deferred to `feat/period-aware-rent`; do not implement it here.
- Do not point local development at production Neon. Use `db:refresh:local`; validate Neon HTTP batching only against a separate Neon branch.

## Next
1. Refresh `rently_dev` with `SOURCE_DATABASE_URL="$(grep '^DATABASE_URL=' apps/server/.env | cut -d= -f2-)" bun run db:refresh:local`.
2. Run `bun run dev:server:local-db` and test locally; use a Neon branch, never production, for Neon HTTP batch smoke coverage.
3. Push this verified fix branch without merging when approved.
