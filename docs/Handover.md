# Handover — 2026-09-03 — model: GPT-5.6 Sol — branch: fix/ledger-integrity-2026-09-03

Reconciles the stale `feat/multi-unit-lease-agreements` notes (already merged into `main`) and records the new ledger/lifecycle bugfix branch. This is the gitignored local mirror of the root `Handover.md`.

## Done
- Created `fix/ledger-integrity-2026-09-03` from clean `main@2250e3f`, tagged `pre-ledger-integrity`.
- Multi-unit agreement expand (`0020`) and active-lease partial unique index (`0021`) confirmed already in `main`.
- Wrote `docs/Bug-2026-09-03-ledger-integrity.md` and dated decisions (idempotency keys, deferred period-aware rent).
- Completed S1–S7 (`443cbca` through `134ba50`) with db generation/migration, type, Biome, Vitest (151 tests), and build verification.
- Added Docker-only `rently_dev` refresh from Neon; local development uses `dev:server:local-db`.
- Added guarded `db:migrate:local`, limited to `localhost/rently_dev`.
- Added `db:seed:local`; the existing `db:seed` remains production-targeted.
- `bun run dev` now forces the local `rently_dev` database.

## In-progress
- Restore production-shaped data into local `rently_dev` and test manually before opening a PR.

## Broken
- Migration `0022` was accidentally applied to production Neon. It is safe and additive only (nullable columns + partial indexes); leave it so the deployment skips it.

## Avoid
- No production Neon access from local development; no non-null `agreementId`/`paymentGroupId`; no utility-settlement unique index (void-then-repay); period-aware rent deferred.

## Next
- Refresh `rently_dev`, use `dev:server:local-db`, then test; test Neon HTTP batches only against a separate Neon branch.
