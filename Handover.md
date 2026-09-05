# Handover — 2026-09-03 — model: GPT-5.6 Sol — branch: fix/ledger-integrity-2026-09-03

Reconciles the stale `feat/multi-unit-lease-agreements` notes (that work is already merged into `main` via `d716bd9`/`2250e3f`) and records the new ledger/lifecycle bugfix branch.

## Remediation plan

- The repository-wide audit remediation plan is `docs/Fix-Plan-2026-09-05.md`.
- New chats must read that plan and implement only one numbered slice at a time.
- The plan assumes the current dirty branch is reconciled before any new remediation branch starts.

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
- Wired tenant meter readings for combined agreements (uncommitted): the readings tab selects an active unit, sends its `leaseId`, and scopes its prior-reading estimate/history to that unit. Manual verification remains: use an existing local tenant with two active leases, submit one reading per selected unit, then confirm separate owner-visible bills and unit-specific prior readings/estimates. Do not use a newly invited tenant.
- Fixed the latest manual-test regressions (uncommitted): owner-prepared tenant profiles no longer duplicate against their pending invite; tenant list/detail lease joins are owner-scoped; tenant detail now excludes foreign lease IDs from its active lease mapper (preventing Owner-B's follow-up lease fetch from returning 403); tenant profile/invite edits work before a lease exists; terminated leases can be safely reactivated with the existing active-unit conflict guard; nested negative meter-reading validation is displayed; the dashboard greeting no longer hydrates session-dependent text from a different server value; and payment list rows no longer multiply when a shared tenant has profiles for multiple owners.
- Payment cards and rows now show a `Paid` badge for positive payment records; reversal records remain distinct and unmarked.
- Payment `Paid` badges now disappear from originals that have a matching reversal. Combined utility bills now subtract settled rent, clamp utility due totals at zero, and only show strikethrough `Original` amounts when a net credit/discount exists; maintenance and other flat charges remain in paise throughout the aggregation.
- Combined utility groups now derive outstanding rent from owner-scoped rent payments, so paid rent no longer inflates popup totals; the same due calculation is used by cards, rows, combined-payment dialogs, and printable combined bills.
- Tenant portal now treats agreements as the active-unit source: overview and My Bill aggregate every active unit's rent plus current-month outstanding utilities; Profile lists all current units; Reading waits for agreement data; payment records include unit/property context, including grouped payments.
- Utility card edits now convert flat charge/rate fields back to paise before calling the API. Utility deletion now checks any payment/credit history before delete, avoiding a foreign-key 500 and preserving the audit trail; history-free unpaid utilities remain deletable.
- Utilities with a voided payment now expose `Payment voided` in the API list read model and show that status across cards, rows, and detail dialogs. Their edit/delete actions are hidden because the retained payment/reversal ledger locks financial terms; recording a replacement payment remains available.
- Combined-bill dialogs now hide Edit for `Payment voided` utilities and correctly open the edit form for ordinary unpaid utilities; previously that callback only closed the dialog.
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

## Latest Verification
- `bun run check-types` passes all 6 tasks.
- Focused Biome checks and `git diff --check` pass for the changed paths.
- `SKIP_ENV_VALIDATION=1 bunx vitest run packages/api/src/routers/test/invite.test.ts packages/api/src/routers/test/tenant-removal.test.ts` passes 19 tests, including the shared-tenant owner-isolation regression. Without the override, both suites stop at missing `RESEND_API_KEY` before running.

## A01 reconciliation (2026-09-05, Muse Spark, read-only, no commit)
- Branch: `fix/ledger-integrity-2026-09-03` (dirty, 34 modified + `docs/Fix-Plan-2026-09-05.md` untracked). Rollback tag `pre-ledger-integrity` still valid for committed work; no new tag (no commit per plan).
- Triage of dirty tree vs Handover claims — all claimed work present, no unrelated strays:
  - Owner-isolation API (`tenant.ts` owner-scoped property joins + lease filter + pre-lease profile/invite edit auth; `payment.ts` owner-scoped receipt profile join): matches Handover In-progress para 3 + new `invite.test.ts` shared-tenant regression (1 tenant per owner, owner-scoped payments/activeLeases, per-owner profile addresses).
  - Lifecycle guard (`lease.ts`: terminated reactivation-only, expired immutable): matches para 3 reactivation claim.
  - Utility ledger read model (`utility.ts`: non-reversed `receiptPaymentId/Date`, `hasReversedPayment`; delete blocked on any payment/credit history; `recordUtilityPayment` returns `paymentDate`): matches paras 8-9. `validators/utility.ts` carries the two new read-model fields.
  - Ledger display (Paid badges + reversed-original suppression, `Payment voided` status, combined-rent-from-payments, paise fixes, cache invalidation, optimistic paid-date): matches paras 4-6, 8-10. `payment.ts` error-message wording change is UI copy only.
  - Meta: `.gitignore` un-ignores only `docs/Fix-Plan-2026-09-05.md`; `TODO.md` marks S1-S7 done + adds manual meter-reading item; `Handover.md` Remediation-plan section + paras.
- Verification re-run (Docker `pg_db_local_rently` had to be started; first vitest run failed ECONNREFUSED before that):
  - `bun run --filter @rently/db db:generate` → No schema changes (no drift, no migration needed for A01).
  - `bun run check-types --force` → 6/6 pass (plain run was turbo cache-hit, re-ran with `--force`).
  - `bunx biome check` on all 31 changed ts/tsx files → 0 errors (2 warnings + 1 info, incl. pre-existing `items[0]!` lint in `utilities/[id]/page.tsx`); `git diff --check` clean.
  - `bun run --filter @rently/db db:migrate:test` → migrations applied successfully.
  - `SKIP_ENV_VALIDATION=1 bunx vitest run invite.test.ts tenant-removal.test.ts` → 19/19 pass.
- Still outstanding (manual, unchanged): multi-unit tenant meter submission per unit; ₹1,200 check on original lease `01a06bc0…` (absent locally); Shivam erroneous group `b9a5de70…` void+re-record awaiting user approval.
- Next: A01 is verified but NOT committed (needs user approval per plan §3/A01). Do not cut `fix/ci-test-gate` (A02) until user approves commit/split of this tree so `main` can be a clean base.
