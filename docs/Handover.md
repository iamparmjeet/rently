# Handover — 2026-08-26 01:00 — model: muse-spark-1.2 — branch: fix/beta-bugfix-audit-2026-08-26

## Done
- `main@b2ed822` merged `fix/empty-state-background` + `feat/account-linking-security 6489ee1` (Google link/unlink, set-password, sessions). `check-types` 6/6, `build` 5/5.
- Audit 2026-08-26 complete: 10 bug classes C1-C6/H1-H6 + 10 frontend gaps documented in `docs/Bug-2026-08-26-beta-audit.md` (this branch's Bug trace). Plan with 10 slices + rollback + tier.
- Branch `fix/beta-bugfix-audit-2026-08-26` created off `b2ed822`; `docs/Constraints.md` updated github-centric, `docs/Bug-2026-08-26-beta-audit.md` created.

## In-progress
- **Ship-loop Map+Constrain+Plan done** — awaiting owner approval for S1. Next slice per plan:
  - S1 Small: `escapeHtml(message)` `packages/email/src/index.ts:385` + `removeUtility` GST guard + GST validator hardening. Verify `check-types` + `biome` + `vitest run packages/email/src/index.test.ts`.
  - No code written yet (plan-only). Approval gate per High-risk workflow.

## Broken / Excluded
- R2 private bucket operational checks `TODO.md:127-128` (`r2 bucket cors list`, unauth denial, presigned expiry smoke) — **separate infra ticket**, not this branch per owner instruction.
- Wrangler manual `cors set`/`deploy` from local is forbidden per `docs/Constraints.md` — CI github-centric, local only `wrangler dev` for validation.

## Avoid
- Do not reuse subscription discounts; do not add `utilities.discount`; do not grant `admin` property writes; do not re-introduce 2FA (`TODO.md:253` deferred).
- Do not mutate `utilities.totalAmount` after `payments`/`credits` — use `bill_credits` only.
- Do not batch slices; one logical change per commit.

## Next session — exact first action
1. Get owner approval on `docs/Bug-2026-08-26-beta-audit.md` S1-S10 order.
2. Implement **S1** exactly, then `bun run check-types && bunx biome check packages/email/src/index.ts && vitest run packages/email` — paste evidence — then `git add` + commit. Repeat per slice.
3. After S1-S7 green, run full `bun run test` (rently_test) + `bun run build` + manual `beta-smoke-test.md` steps 1-17 with `AADHAAR_UPLOADS_ENABLED=false` (Aadhaar blocked path must return `AADHAAR_UPLOAD_DISABLED`).
4. Open PR `fix/beta-bugfix-audit-2026-08-26 → main`, attach Bug trace + Decisions log.

## Branch context
- Base `b2ed822` (main). Branch `fix/beta-bugfix-audit-2026-08-26`. Prior bases `7d8a1b9`/`b6c7f5e` rolled into main. `docs/` gitignored — `TODO.md` is merge truth, `docs/Bug-*` traced via `git add -f` when shipping PR. Root `Handover.md` mirrors this for github visibility.
