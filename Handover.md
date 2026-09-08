# Handover — 2026-09-06 — model: ZLM 5.3 Flash — branch: integ/phase-a-baseline (batching A03+; see workflow note)

## Workflow note (2026-09-05, owner-directed)
- Batching: slices merge one-branch-per-slice into `integ/phase-a-baseline` (cut from clean `main@8e27688`, rollback tag `pre-integ-phase-a-baseline`), then one rollup PR into `main`. Rollback tags per slice retained. Lefthook is the fast local gate for integration PRs; GitHub CI runs only on PRs targeting `main` (PR-only, no per-commit runs).
- A03 merged as PR #7 (CI green, merged 2026-09-05). Fix-Plan A03 stays `[~]` until Terra review.
- Implementer is now Muse Spark throughout; Terra review is deferred, not waived.
- Terra review debt (must clear before any `[x]` or `main` rollup): A03 (Terra Medium), A04 (Terra High), and every later slice per Fix-Plan §7.
- Muse rules until debt is paid: no business-semantic decisions without stopping to ask; nothing production-touching; slices stay `[~]` at best.
- Standing owner authorization (2026-09-06): implement → verify → commit file-by-file (conventional, no emoji) → push each commit → merge into `integ/phase-a-baseline` after gates + Lefthook pass. No per-step approval, no PRs, no rollup PR into `main`, never touch `main`. Terra batch review happens on the final integ branch.

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

- **Cash-refund recovery (2026-09-07, GPT-5.6 Terra):**
  `fix/refund-reversal-ledger` cut from clean
  `integ/phase-a-baseline@1bdaa252`; rollback tag
  `pre-refund-reversal-ledger`. Review repair: reverse a cash-refund credit
  with a positive payment reversal linked to the original refund payment, and
  reject direct refund-payment voiding. One financial slice; no migration.
  Rollback: revert this slice commit, then rerun the H04 recovery test.

- **Cash-refund ledger event (2026-09-07, GPT-5.6 Terra):**
  `fix/cash-refund-ledger-event` cut from clean
  `integ/phase-a-baseline@408545e6`; rollback tag
  `pre-cash-refund-ledger-event`. Scope: a paid bill's cash refund must pair
  the existing negative credit note with a linked negative payment, so both
  the bill balance and cash ledger stay truthful. It is not a payment void.
  Plan: add a refund payment type/link and constraints; atomically write and
  idempotently recover the pair in `createCredit`; leave the already-settled
  rent-period allocation unchanged; retain only the two
  existing paid-refund regression cases, extended to assert the linked cash
  event. Implemented: migration 0044 adds the link/uniqueness constraint and
  permits the server-only `refund` payment type; both Neon batch and callback
  transaction writers create and link the signed pair. Verification:
  `db:generate` no drift, `db:migrate:test`, focused Biome, `check-types
  --force`, `git diff --check`, and all 5 H04 tests pass. Rollback: revert
  the slice commit, then rerun migration replay and the H04 tests.

- **Rent-period calendar semantics repair (2026-09-07, GPT-5.6 Terra):**
  `fix/rent-period-calendar-semantics` cut from clean
  `integ/phase-a-baseline@6557ffd9`; rollback tag
  `pre-rent-period-calendar-semantics`. High-risk ledger slice. Scope is to
  project UTC lease instants to `Asia/Kolkata` for all period calculations,
  implement R3's first-valid-due-date rule, and provide a non-silent
  reconciliation path for derived charges. Do not edit applied migration 0032
  or mutate production ledger records manually.
  - Progress: red C04 integration tests reproduced both defects; live accrual
    now projects UTC instants into `Asia/Kolkata`, and R3 first-period due
    dates move to the next valid period. Generated migrations 0042/0043 relax
    the charge due-date constraint to current-or-next period, repair only
    derived due-date metadata, and flag UTC/IST charge-period candidates for
    owner reconciliation without deleting or rewiring allocations.
  - Verification: `db:generate` (no drift), `db:migrate:test`, two targeted
    boundary regressions, isolated C04 timeout cases, `check-types --force`,
    focused Biome, `git diff --check`, and `build` (5/5) pass. Combined
    database suites can hang/timeout under the shared-test-database runner;
    terminate their stale parent/worker before any rerun. Ready to commit,
    push, and merge after final review.
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

## B08 Individual settlement concurrency (2026-09-05, Codex, branch fix/atomic-individual-settlement)
- Base confirmed: `integ/phase-a-baseline@cb1540df`; rollback tag `pre-atomic-individual-settlement` already existed before work began. `main` was not used or modified.
- Plan: keep node-postgres row-lock transactions; replace Neon read-then-write settlement inserts with one SQL statement that takes a scope advisory lock, re-reads the balance, conditionally inserts, and updates `utilities.isPaid` in the same statement. Apply the same scope lock to single-payment reversal so payment-versus-reversal has one serialization domain.
- Design gate: Sol High preferred and final review remain outstanding; this slice must stay `[~]` until reviewed, even after implementation and verification.
- Implementation and verification complete on this branch; full Vitest passed
  (51 files / 256 tests) and local build passed (5/5). Design gate and final
  review remain outstanding, so the slice is not yet merge-ready.
- Known limitations: Neon-path tests require a disposable Neon branch or a driver-faithful mock; production Neon must not be mutated.

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
- A01 closed 2026-09-05: tree committed as 6 sequence-wise commits (`29e17da`..`bd6bbe8`), pushed, merged to `main` as `5dd4614` (regular merge, PR #5). Fix-Plan A01 marked `[x]`. `main` is now the clean base.
- Next allowed slice: A02 on fresh branch `fix/ci-test-gate` from `main@5dd4614`.

## A02 Restore CI (2026-09-05, Muse Spark, uncommitted)
- Branch: `fix/ci-test-gate` from `main@e1ce03d`; rollback tag `pre-ci-test-gate`. Only change: new `.github/workflows/ci.yml` (11 steps).
- Old workflow (removed in `8fa4bc6`) had no Postgres service, no migrate, and relied on `secrets.TEST_DATABASE_URL`. New workflow: `postgres:18.6` service (same image as local `docker-compose.yaml`), creates `rently_test` owned by `rently_db_user`, writes a deterministic 8-line `apps/server/.env.test`, then drift check (`db:generate` + `git diff --exit-code`), `db:migrate:test` + `VACUUM (ANALYZE)`, `check-types`, `biome check .`, `build`, full `vitest run` — all with `SKIP_ENV_VALIDATION=true` on build/test.
- Key finding: `apps/server/.env.test` is untracked local-only, so CI must write it. Minimal viable content proven by experiment: `NODE_ENV=test` + `DATABASE_URL` (rently_test) + `BETTER_AUTH_URL` + 5 `NEXT_PUBLIC_*` URLs. Without `NODE_ENV=test` the suite runs ~25x slower (490s aggregate, 10s-timeout failures); with it, 160/160 in ~5s on a freshly migrated DB. The 5 `NEXT_PUBLIC_*` URLs satisfy `@rently/env/web` import validation; `BETTER_AUTH_URL` satisfies the auth email-verification test.
- Verification: YAML parses; `git diff --check` clean; `db:generate` no drift; fresh drop/create/migrate (23/23) + exact CI env + full suite → 37 files, 160 tests, all pass (~7s). `check-types`/full `build` unchanged by this slice (no code touched); they run as CI steps. Biome N/A (YAML-only change).
- Not committed/pushed (needs approval). After merge, enabling required-status-checks on `main` in GitHub settings is a manual owner step for the "PRs cannot pass while failing" done-criteria.
- Owner constraint (2026-09-05): no CI on branch pushes — lefthook is the push-time gate and per-commit Actions runs are noise. Triggers cut to `pull_request → main` + `workflow_dispatch` only. `.env` concern resolved: workflow writes its own deterministic test env, no secrets needed.
- Next: commit/push with approval → open PR → then A03 from clean `main`.

## A02 CI restore (2026-09-05, Muse Spark, branch fix/ci-test-gate, tag pre-ci-test-gate)
- Wrote `.github/workflows/ci.yml` (11 steps; old file was deleted in `8fa4bc6`, old version relied on `secrets.TEST_DATABASE_URL` with no DB service or migrations).
- Job: pg 18.6 service (same creds as local compose) → create `rently_test` → write deterministic 8-line `apps/server/.env.test` → `db:generate` + git-diff drift gate → `db:migrate:test` + `VACUUM (ANALYZE)` → `check-types` → `biome check .` → `build` → `vitest run` (both with `SKIP_ENV_VALIDATION=true`).
- Key finding: `apps/server/.env.test` is untracked, so CI must write it. Proven minimal set: `NODE_ENV=test` + `DATABASE_URL` (rently_test) + `BETTER_AUTH_URL` + 5 `NEXT_PUBLIC_*` URLs. Without the URLs, 3 files fail at import; without `NODE_ENV=test`, the suite runs ~25x slower (490s aggregate, timeout failures) on a cold DB — with it, 160/160 in ~7s on a freshly migrated DB.
- Verification: YAML parses; `git diff --check` clean; `db:generate` no drift; fresh drop/create/migrate (23/23) + exact CI env + full suite → 37 files / 160 tests pass. check-types unaffected (no TS changed). `.env.test` restored to local 50-line version; branch holds only `.github/workflows/ci.yml`.
- First CI run failed on `bun install --frozen-lockfile`: committed `bun.lock` (from `60f25f3`) was stale — `@types/bun` range `^1.3.4`/`^1.3.14` now resolves to 1.4.1. Reproduced locally with pinned bun 1.3.13, regenerated (converged after 2 passes, +8 lines, email+env scopes only), frozen check exits 0, `check-types --force` 6/6, full suite 160/160. Committed as lockfile refresh on this branch.
- Second CI failure on Schema drift check: `drizzle.config.ts` parses `DATABASE_URL` at load and CI has no `apps/server/.env` (untracked), so `db:generate` died with `Invalid URL`. Fixed by setting a dummy `DATABASE_URL` in that step's env (generate is offline, never connects); reproduced the exact failure locally by hiding `.env`, proven fixed the same way.
- Third CI failure on Build: Next `next.config` validates `@rently/env/web` at load and CI has no `apps/*/.env.local` (untracked; that is why local builds pass). Fixed by adding the 5 dummy `NEXT_PUBLIC_*` URLs to the Build step env. Proven locally: hid all six env files, full `bun run build` 5/5 green with only the CI step env; env files restored.
- Opened PR #6 (fix/ci-test-gate → main); triggers are PR-only + manual dispatch per owner constraint, so CI runs there and on no branch push.
- A02 verified end-to-end 2026-09-05: PR #6 CI run fully green (install → drift → migrate → types → Biome → build → 160 Vitest). Fix-Plan A02 marked `[x]`.
- Remaining manual owner step: required-status-checks branch protection on `main` after first green run. Then A03 from clean `main`.

## A03 Local DB bootstrap (2026-09-05, Muse Spark, branch fix/local-db-bootstrap, tag pre-local-db-bootstrap)
- Base: clean `main@8e27688` (PR #6 merged 2026-09-05T09:17:41Z; Fix-Plan A01/A02 `[x]`; tree clean). Fix-Plan A03 set to `[~]` (implemented+verified, awaiting Terra Medium review — do not mark `[x]` until reviewed).
- Gap proven: compose `POSTGRES_DB` creates only `rently_db`; the only `CREATE DATABASE rently_test` lived in CI; nothing created `rently_dev`; no committed test-env template existed (local `apps/server/.env.test` is untracked and holds real secrets, so it must never be committed).
- Changed (no migration; unrelated files untouched):
  - `scripts/db-bootstrap-local.sh` (new, executable): idempotent `CREATE DATABASE rently_dev/rently_test` via `\gexec … WHERE NOT EXISTS`, localhost-guarded (refuses non-`localhost:5432` admin URLs), seeds `apps/server/.env.test` from the template only when missing.
  - `apps/server/.env.test.example` (new): deterministic 8-line non-secret template, byte-parity with the CI heredoc.
  - `apps/server/.gitignore`: `!.env.test.example` negation (same pattern as A01 docs un-ignore).
  - `package.json` + `packages/db/package.json`: `db:bootstrap` wiring (root + `--filter @rently/db`).
  - `README.md`: step 2 runs `db:start` (root-runnable, no `cd`) + `db:bootstrap`; step 4 adds `db:migrate:test`.
- Tests: `packages/db/src/bootstrap-local.test.ts` (new, 5 tests — written first, failed 5/5 pre-fix): template determinism, gitignore committability, CI-parity, script guards + no-overwrite, script wiring + README docs.
- Verification (in plan order): `db:generate` no drift → `check-types` 6/6 → Biome clean (fixed import order/format in new test) → `db:migrate:test` on freshly recreated empty `rently_test` → focused suite 27/27 (bootstrap + driver + invite + tenant-removal) → full suite 38 files / 165 tests pass.
- Live proofs (container `pg_db_local_rently`, `rently_dev` never dropped): no-op rerun lists both DBs and leaves the 50-line `.env.test` checksum-identical; `DROP rently_test` → bootstrap recreates it; moving `.env.test` aside → bootstrap seeds the exact 8-line template, original restored afterwards.
- Committed as `a3a1c4f`, pushed, opened PR #7 (fix/local-db-bootstrap → main) with user approval. Merging waits on Terra Medium review. Next allowed slice after merge: A04 from clean `main`.

## A04 Test DB safety guard (2026-09-05, Muse Spark, branch fix/test-db-safety-guard, tag pre-test-db-safety-guard)
- Base: clean `integ/phase-a-baseline@c588e6d`. Fix-Plan A04 `[~]` (implemented+verified, Terra High review owed — stays `[~]` until then).
- Hole proven: `vitest.config.ts` + `drizzle.config.ts` both checked only the `rently_test` pathname, so a remote database named `rently_test` passed. Root-cause fix in one shared dependency-free helper (both consumers rewired; drift pinned by test).
- Changed (no migration):
  - `packages/db/src/test-db-guard.ts` (new): requires pathname `/rently_test` AND host in {localhost, 127.0.0.1, [::1]} or explicit `RENTRY_TEST_EXTRA_HOSTS` (comma-separated, for disposable Neon branches).
  - `vitest.config.ts`, `packages/db/drizzle.config.ts`: test guards routed through `assertAllowedTestDatabaseUrl`.
- Tests: `packages/db/src/test-db-guard.test.ts` (new, 7 tests — written first, failed at import pre-fix): local accept, wrong-name reject, remote-name reject, lookalike/malformed reject, extra-host allowlist, assert-throws, consumer-wiring pin.
- Verification: `db:generate` no drift → `check-types` 6/6 → Biome clean → `db:migrate:test` → full suite 172/172.
- Live proofs (zero connection risk): remote `rently_test` impostor in `.env.test` → `db:generate` refuses pre-connection; original `.env.test` restored checksum-identical. Note: dotenv `override:true` clobbers env-passed `DATABASE_URL`, so the file-swap (not env override) is the correct negative probe.
- Committed as `add8db6`, opened PR #8 → `integ/phase-a-baseline` with user approval, CI green (~3m17s), merged as `74c6ec9`.

## A05 Deployment safety gates (2026-09-05, Muse Spark, branch fix/deployment-safety-gates, tag pre-deployment-safety-gates)
- Base: clean `integ/phase-a-baseline@2ffe4a6`. Fix-Plan A05 `[~]` (implemented+verified, Terra Medium review owed).
- Findings: `wrangler.json` deployed `AADHAAR_UPLOADS_ENABLED=true` against Constraints (fixed to `"false"`); auth derived the cookie domain from `BETTER_AUTH_URL` hostname instead of validated `env.COOKIE_DOMAIN` (now `resolveCookieDomain`: prod uses validated domain, dev keeps `undefined`; prod value identical `.parmjeetmishra.com`, no behavior change).
- Changed (no migration): `apps/server/wrangler.json` (Aadhaar off); `packages/auth/src/cookie-domain.ts` (new pure helper) + `index.ts` wiring.
- Tests (written first, all red pre-fix): `cookie-domain.test.ts` (prod/dev + wiring pin), `deployment-config.test.ts` (wrangler Aadhaar off + bare cookie domain + schema default tripwire), `tenant-document.test.ts` +1 Aadhaar-disabled upload rejection (`BAD_REQUEST`/`AADHAAR_UPLOAD_DISABLED`; existing pan test proves non-Aadhaar still works).
- Credentials sweep: no genuine secrets in tracked test/example/fixture files (only README `<account-id>` placeholder + env-constructed endpoint string); `invite.test.ts` passwords dummy. Untracked local `apps/server/.env.test` holds real secrets by A02/A03 design (gitignored) — left untouched.
- Verification: `db:generate` no drift → `check-types` 6/6 → Biome clean → `db:migrate:test` → full suite 179/179.
- One self-caught edit mangled an import in `auth/index.ts`; repaired immediately, repair verified in final diff.
- Opened PR #9 → `integ/phase-a-baseline` with user approval, CI green (~3m15s), merged 2026-09-05.

## B01 Payment type/utility invariant (2026-09-05, Muse Spark, branch fix/payment-type-invariant, tag pre-payment-type-invariant)
- Base: clean `integ/phase-a-baseline@4abc83a`. Fix-Plan B01 `[~]` (Terra High review owed).
- Pre-verify: `rently_dev` holds zero CHECK violations (rent/deposit null, utility non-null, reversals split 5/3 as void-preserved); UI sends matching pairs; writers audited (generic create, group create/void, recordUtilityPayment, fixtures, sample-workspace).
- Changed (one migration `0023`): schema CHECK `payments_type_utility_check` (utility⇔utilityId; reversal exempt until B03 link); `CreatePaymentSchema` excludes reversal + pairing refine (handler's now-untypable reversal check removed; DB is the backstop); update path already immutable.
- Tests first (15, red-precise): 5 API (2 reject-mismatch, 1 reject-reversal, 2 controls) + 10-cell DB table incl. reversal exemption. Self-caught: teardown tracked payments by id and leaked on negative paths — now lease-scoped; drizzle nests driver `code` under `cause`.
- Incident: first test run leaked 10 fixture rows into `rently_test`, which correctly BLOCKED `0023` (constraint doing its job). Cleaned precisely by fixture markers (all rows proven B01 leaks), re-migrated clean, 15/15, zero leaks after.
- Verification: `db:generate` no drift → `check-types` 6/6 → Biome clean → `db:migrate:test` (constraint verified in pg_constraint) → full suite 194/194. `rently_dev` untouched (migration runs there via `db:migrate:local` at owner discretion).
- CI incident (build, not in local verify order): pairing `.superRefine` on `CreatePaymentSchema` broke dashboard's key-overwriting `.extend` (zod forbids it on refined schemas). Restructured: base keeps reversal exclusion only; pairing lives on new `CreatePaymentRequestSchema` used by the router; form untouched. Added extend-smoke test so local runs catch it. Local `bun run build` 5/5 green; full suite 195/195, zero leaks.
- Committed as `a78b66b` + `1c8ac80`, opened PR #10 → `integ/phase-a-baseline` with user approval. First CI run failed on dashboard build (restructure above); second run green, merged 2026-09-05. Local `bun run build` also regenerates `apps/*/next-env.d.ts` route-path churn — restored, never committed.

## B02 Financial input invariants (2026-09-05, Muse Spark, branch fix/financial-input-invariants, tag pre-financial-input-invariants)
- Base: clean `integ/phase-a-baseline@22d6894`. Fix-Plan B02 `[~]` (Terra High review owed).
- Preflight on production-shaped `rently_dev`: zero violations for every rule; equality case found (6/20 bills share prev==cur reading date) so period rule is `<=`, not `<`. End==start absent; API keeps strict `>` (existing dateOrder), DB floor `>=`.
- Changed (one migration `0024`, 11 CHECKs): units baseRent>0; leases rent>0, deposit>=0-nullable, dueDay 1-31-nullable, end>=start; agreements dueDay + dates; utilities fixedCharge/rate>=0-nullable, readings>=0, cur>=prev, prevDate<=curDate.
- API: lease money/dueDay refines on Create/Update/Combined; baseRent refine on Create/Update unit; shared `utilityBoundsViolation` on CreateUtilityRequestSchema (base stays unrefined for BatchItemSchema omit — proven by zod probe) + Update refine; batch loop per-item check; merged-value handler checks for partial updates (updateLease dates via extended getLeaseWithOwner select; updateUtility merged bounds incl. dates).
- Tests first (19): 15 API incl. boundaries (rent 1, deposit 0, dueDay 31, zero/equal readings+dates) + 4 DB spot tables. Teardown derives from fixture units (B01 lesson).
- Incident: early red runs leaked 39 units into `rently_test`, blocking `0024` (constraint correct). Cleaned by markers (all rows proven leaks), re-migrated, 19/19, zero leaks after.
- Verification: `db:generate` no drift → `check-types` 6/6 → Biome clean → `db:migrate:test` → full suite 214/214 → local `bun run build` 5/5 (B01 lesson; next-env.d.ts churn restored, uncommitted). `rently_dev` untouched.
- Committed as `955fb39`, opened PR #11 → `integ/phase-a-baseline` with user approval, CI green (~3m6s) first run, merged 2026-09-05.

## B03 design gate (2026-09-05, Muse-conducted — Terra/Sol review still owed)
- Inspected: voidPayment (batch+tx), voidPaymentGroup (shared reversalValues), B01 CHECK, billCredits self-FK precedent, all payment writers, rently_dev history.
- Preflight (production-shaped `rently_dev`): 8/8 reversals unambiguous — every `referenceNumber` matches exactly one non-reversal payment, amounts symmetric. Zero ambiguous rows.
- Blocking decisions: (D1) link = voided original; non-reversals never linked (CHECK both directions). (D2) presence enforced by CHECK — justified by 8/8 backfill + empty CI + fixture updates below. (D3) backfill rule = single PK match on `referenceNumber` + target non-reversal. (D4) FK NO ACTION, no cascade — ledger must not evaporate. (D5) `referenceNumber` retained untouched. (D6) readers untouched (B12); duplicate-void guard stays referenceNumber-based (B04). (D7) backfill proof = dev dry-run in txn+rollback (zero mutation) + structural migration test + no-op UPDATE execution.
- Consequences accepted: payment-export/receipt/rent-amount-due/B01 fixtures inserting unlinked reversals must gain links (test-only); uniqueness deferred to B04.
- Risks for Terra-final: CHECK makes manual reversal inserts require links (intended); text-UUID match assumes canonical form (verified in dev, not proven universally).
- Acceptance tests: migration contains backfill UPDATE; void/voidGroup set link + retain ref; FK blocks original delete (23503), allows reversal delete; void-then-repay via API; raw unlinked reversal and linked non-reversal rejected (23514); UPDATE no-op runs clean; report query executes.

## B03 Payment reversal linkage (2026-09-05, Muse Spark, branch fix/payment-reversal-link, tag pre-payment-reversal-link)
- Base: clean `integ/phase-a-baseline@6e410f0`. Fix-Plan B03 `[~]` (Muse gate conducted above; Terra/Sol final review owed).
- Changed (one migration `0025`): nullable `payments.reverses_payment_id` self-FK (NO ACTION); presence+direction CHECK; backfill UPDATE (single-PK match on referenceNumber + target non-reversal) ordered BEFORE the CHECK. Writers set the link in all 3 insert sites (void batch/tx, group shared values); referenceNumber retained; readers + duplicate-void guard untouched for B12/B04.
- Gate-mandated test-only fixture updates (unlinked-reversal inserts now illegal): payment-export + rent-amount-due gain links; receipt reversal fixture gains a linked original; B01 reversal cells insert linked originals.
- Tests first (8, all red pre-fix): migration structural + UPDATE execution; single/group void links + ref retained; void-then-repay (repay unlinked, exactly one reversal); FK 23503/allowed delete; presence/direction 23514; report query.
- Backfill proof on production-shaped data: scratch clone of dev `payments` (dropped after) — UPDATE linked 8/8, CHECK clean, 0 ambiguous. `rently_dev` itself never mutated.
- Incidents: (1) new column broke two explicit payment selects vs PaymentSelectSchema outputs (TS2345) — added `reversesPaymentId` to both list selects; (2) full-suite count moved 214→222.
- Verification: `db:generate` no drift → `check-types` 6/6 → Biome clean → `db:migrate:test` → full suite 222/222, zero leaks → local `bun run build` 5/5 (next-env churn restored).
- Committed as `cee0774`, opened PR #12 → `integ/phase-a-baseline` with user approval, CI green (~3m28s) first run, merged 2026-09-05.

## B04 Atomic single-payment void (2026-09-05, Muse Spark, branch fix/atomic-payment-void, tag pre-atomic-payment-void)
- Base: clean `integ/phase-a-baseline@9be11d3`. Fix-Plan B04 `[~]` (Terra High review owed). Group void untouched (B05).
- Pre-checks: dev has zero duplicate reversals (unique index dev-safe); no test/UI depends on the old "Payment already voided" error.
- Changed (one migration `0026`, partial unique index on `reversesPaymentId` for reversals): void is now idempotent — link-based pre-check returns the existing reversal; genuine races arbitrate on the index (uniform optimistic insert→catch-23505→return-winner, tx-abort-safe with converge outside the dead tx); isPaid flag converges for winner and loser via extracted `syncUtilityPaidFlag`. `violationCode` unwraps drizzle's `cause`-nested code (existing top-level-only check left alone, out of scope).
- Behavior change (recorded): second void of the same payment returns the existing reversal instead of erroring — required for retry-after-timeout; UI already hides void for reversed originals (H05 will formalize).
- Tests first (5, all red): true-concurrency double void (same id, one row), retry, void-voided returns existing, voiding a reversal still refused, raw duplicate insert 23505. Teardown needed agreement-wrapper cleanup (lease.createLease side effect).
- Verification: `db:generate` no drift → `check-types` 6/6 → Biome clean → `db:migrate:test` → full suite 227/227, zero leaks → local `bun run build` 5/5 (next-env churn restored).
- Committed as `04be6953`, opened PR #13 → `integ/phase-a-baseline` with user approval, CI green (~3m25s) first run, merged 2026-09-05.

## B05 Atomic group void (2026-09-05, Muse Spark, branch fix/atomic-group-void, tag pre-atomic-group-void)
- Base: clean `integ/phase-a-baseline@56b6134f`. Fix-Plan B05 `[~]` (Terra High review owed). Single voids untouched (B04).
- Pre-check: dev has 1 reversal group, zero duplicates — unique index dev-safe.
- Changed (one migration `0027`, plain UNIQUE on `paymentGroups.reversesPaymentGroupId`; NULL originals exempt by Postgres semantics): group void idempotent with completeness gate — pre-check/catch-23505 (both paths, abort-safe) serve the existing group only when allocation count matches the original; partial groups throw loud INTERNAL (never served, never auto-deleted — financial-record rule); isPaid converges via shared helper. Single-void `syncUtilityPaidFlag` reused for the group loop.
- Tests first (4, all red): true-concurrency group voids (same group, linked allocations, single row), repeat returns complete group, partial group → INTERNAL with row counts unchanged, raw duplicate group 23505.
- Incidents: (1) DB test omitted the first void (no conflict possible) — fixed; (2) unused-param + bad-cast type errors — removed param, typed full shape; (3) early red runs leaked 20 groups — cleaned by B05 markers.
- Verification: `db:generate` no drift → `check-types` 6/6 → Biome clean → `db:migrate:test` → full suite 231/231, zero leaks → local `bun run build` 5/5 (next-env churn restored).
- Committed as `03e3b5fa`, opened PR #14 → `integ/phase-a-baseline` with user approval, CI green (~3m25s) first run, merged 2026-09-05.

## B06 Atomic credit reversal (2026-09-05, Muse Spark, branch fix/atomic-credit-reversal, tag pre-atomic-credit-reversal)
- Base: clean `integ/phase-a-baseline@be7aca91`. Fix-Plan B06 `[~]` (Terra High review owed).
- Pre-checks: dev has zero credit reversals (index trivially safe); nothing depends on CONFLICT "Already reversed".
- Changed (one migration `0028`, partial unique on `bill_credits.reversesCreditId`): reverseCredit idempotent — marked-credit pre-check returns existing pair; uniform insert→catch-23505→adopt-winner→complete-original on both paths (abort-safe); insert-first order preserved (dangling reversal recoverable, dangling mark is not). Extracted `markCreditReversed` + `findReversalByCredit` + wrap-aware `violationCode`.
- Behavior change (recorded): retry of a reversed credit returns the pair instead of CONFLICT.
- Tests first (5): concurrent (same id, one row), retry, partial-orphan completion (mark set, no dupe), link+mark control, raw duplicate 23505.
- Incidents: (1) uuidv7 timestamp-prefix collided on hand-rolled `KQ-CN-<8>` note numbers (false green) — notes now full-suffix via helper; scratch probe + leftovers removed. (2) stray `});` from a large edit + two missing undefined guards — repaired, tsc clean. (3) bare `tsc -p` showed phantom errors in untouched files — authoritative `check-types --force` 6/6 green; bare invocation disregarded.
- Verification: `db:generate` no drift → `check-types --force` 6/6 → Biome clean → `db:migrate:test` → full suite 236/236, zero leaks → local `bun run build` 5/5 (next-env churn restored).
- Committed as `15f5acd0`, opened PR #15 → `integ/phase-a-baseline` with user approval, CI green (~3m20s) first run, merged 2026-09-05.

## B07 Settlement idempotency keys (2026-09-05, Muse Spark, branch fix/settlement-idempotency-clients, tag pre-settlement-idempotency-clients)
- Base: clean `integ/phase-a-baseline@7f8e6d47`. Fix-Plan B07 `[~]` (Terra Medium review owed; Muse did the UI per plan).
- Design: keys REQUIRED in all live settlement schemas (create/group/record-utility/credit/bill-single/batch-item); UI mints per dialog open via shared `useIdempotencyKey` (stable across rerenders/retries, fresh on reopen); combined dialog uses per-leg keys (legs share a lease); batch uses per-type keys (shared lease). Tenant reading submit stays month-guarded, keyless (NULL-skipped).
- Changed (one migration `0029`: utilities.idempotency_key + partial unique): required keys in 6 schemas; record/single/batch handlers gain catch-23505→return-existing (receipt/email skipped on replay); group replay moved BEFORE balance math (retry-after-success has zero dues); UtilitySelectSchema omits the internal column (payments precedent).
- Tests first (11 API + 3 hook): double-submit same key for all 6 entries, missing-key rejections, hook open/retain/reopen. Caught a real ordering bug (group replay after due math) + flushed 2 missed dialogs (agreement button, tenant batch) via check-types.
- Incidents: teardown forgot bill_credits (RESTRICT cascade, 72 leaked rows cleaned by markers); uuid note lesson re-applied in review (server-generated notes, no hand rolls).
- Verification: `db:generate` no drift → `check-types` 6/6 → Biome clean → `db:migrate:test` → full suite 250/250, zero leaks → local `bun run build` 5/5 (next-env churn restored).
- Committed as `0bfded36`, opened PR #16 → `integ/phase-a-baseline` with user approval, CI green (~3m4s) first run, merged 2026-09-05. Commit hook blocked twice (biome `??=` expression-assignment) — rewritten without expression assignment.

## B09 grouped-payment idempotency scope (implemented, 2026-09-05)

- Base: `integ/phase-a-baseline@cb1540df`; branch `fix/group-payment-idempotency-scope`; rollback tag `pre-group-payment-idempotency-scope`.
- Map: `createAgreementPayment` validates owner/agreement -> computes a canonical request fingerprint -> scoped group replay -> derives current active-unit allocations -> atomically inserts one group plus child payments -> returns only the created group/allocations.
- Plan: move the idempotency key and fingerprint to `payment_groups`, add one additive migration and an agreement-scoped partial unique index, remove the group key from child allocation writes, and test cross-agreement, cross-owner, and changed-request replay behavior.
- Changed: migration `0030` adds nullable `payment_groups.idempotency_key` and `request_fingerprint` plus the partial agreement/key index; grouped replay and unique-race adoption are owner/agreement scoped; new child allocations no longer repeat the group key; API responses omit internal metadata.
- Verification: `db:generate` no drift -> `check-types --force` 6/6 -> focused Biome -> `db:migrate:test` -> focused suite 14/14 -> full Vitest 253/253 -> local build 5/5. Command-line test values targeted only disposable local Docker `rently_test`/`rently_dev`; no `.env` files were retained.
- Commit: `52de2c02` (`fix(payment): scope grouped idempotency replay`), opened PR #18 into `integ/phase-a-baseline` and merged after post-rebase CI passed.
- Review debt: Terra High final review remains required for B09 before integration merge.
- Rollback: revert the B09 commit or restore the files to `pre-group-payment-idempotency-scope`; if the additive migration has been applied, use a forward corrective migration rather than deleting ledger rows.
- Constraints: no `main`, no production/`.env`/wrangler mutations, no non-null compatibility FKs, and no business-semantic changes outside grouped-payment replay.

## B12 Canonical ledger reads (2026-09-05, Codex, branch fix/canonical-ledger-reads)
- Base confirmed: `integ/phase-a-baseline@7cc9bfbc`; rollback tag `pre-canonical-ledger-reads`; `main` was not used or modified.
- Signed-ledger implementation is complete. Focused suite passes 2/2; full Vitest passes 252/252; local build passes 5/5.
- Required gates passed: `db:generate` no drift, `check-types --force` 6/6, focused Biome, and `db:migrate:test`.
- Build-generated `next-env.d.ts` changes were restored; no `.env` files were retained.
- Sol/Terra final review remains tracked review debt before any `[x]` or `main` rollup.

## D04 Enforce tenant limits at activation (2026-09-06, ZLM 5.3 Flash, branch fix/tenant-limit-activation)

- Base: `integ/phase-a-baseline@adbbf2aa` (D03 merge); rollback tag `pre-tenant-limit-activation`; `main` untouched. Terra High design gate deferred to owner per Fix-Plan §7.
- Migration **0035_tenant_seat_guard** (one, hand-authored, no schema diff — `db:generate` reports no drift): plpgsql `rently_assert_tenant_seat(p_owner_id, p_tenant_id)` — takes a transaction-scoped advisory lock on `rently:tenant-limit:<ownerId>` (key domain disjoint from `rently:settlement:*`), counts the owner's DISTINCT active tenants **excluding the activating tenant**, and `RAISE EXCEPTION … ERRCODE 'P0340'` when the count ≥ limit — aborting the whole surrounding node transaction / Neon batch, so a refused activation writes nothing and concurrent activations serialize. Limit = latest subscription's `plans.tenant_limit`, fallback literal 10 (file comment pins it to the `TENANT_LIMIT` constant).
- Semantics derived from the code (the design question the plan left open): "a distinct tenant becomes active" = a `leases` row goes `status='active'` for a tenant with no other active lease under the same owner — the exact shipped count of the old `enforceSubscriptionLimit` (per-owner across all their properties, not per-agreement/per-unit). Three activation paths wired (`createLease` pending+registered variants, `createCombinedLease` — one seat for the whole agreement, `updateLease` reactivation). `acceptInvite` writes no lease row, so acceptance is NOT an activation — the Fix-Plan's "concurrent acceptances" test wording is pinned as a concurrent-activation race instead.
- Pending-invite quota defined separately: at most the plan's tenantLimit concurrently-pending unexpired invites per owner (status=pending, not soft-deleted, `expiresAt` not past). It replaces the active-seat check at invite creation — **behavior change**: a full plan can now invite; the refusal surfaces at activation instead. Left a plain count-and-check ON PURPOSE until D07 (invite-creation atomicity is D07's slice).
- Seat freeing needs no seat ledger: the count is derived from live rows, so `terminateLease`/`removeTenant` free seats automatically — pinned by test. `enforceSubscriptionLimit` deleted (no remaining callers); its limit read survives as `getOwnerTenantLimit`.
- Tests (`tenant-limit-activation.test.ts`, 8, rationale header; red/green verified — 6 fail without the enforcement wiring; seat-freeing + SQL-boundary stay green by design): full-plan races on node tx AND Neon batch shim (exactly one of two concurrent activations passes; loser leaves zero partial state — no provisional user, invite still pending, unit still available); multi-lease + combined activations of an already-active tenant are seat-neutral with a refusal control; reactivation refused on a full plan / allowed after a seat frees; `removeTenant` frees the seat; pending quota refusals + expired rows stop counting; full plan can still invite (behavior-change pin); the SQL guard excludes the activating tenant and raises P0340 at the fallback boundary (9 ok / 10 refused).
- Test-infra lessons this slice: the B11 Neon shim needed **column-mapper fidelity** for builder entries (camelCase keys + `new Date` on timestamp strings) because the handlers feed batch rows into drizzle output schemas — B11's shim skipped this only because its handlers read raw execute-entry rows; and teardown is now **owner-scoped** (invites by `invitedById`, provisional user/profile id = invite id) because response-side tracking leaked when red-state refusal expectations did not hold (B01 lesson again).
- Gates in order: `db:generate` no drift → `check-types` 6/6 → Biome clean on all changed files → `db:migrate:test` → focused 27/27 (D04 + invite + tenant-removal) → full suite **62 files / 349 tests + 1 conditional skip** → local build 5/5. `next-env.d.ts` churn restored; zero `d04`-marker residue in `rently_test` (verified before and after the full run).
- Review debt: Terra High. Scrutinize: (1) the "define pending-invite quota separately" reading — invite creation no longer checks active seats (behavior change pinned by a test); (2) the exclusion semantics (activating tenant not counted → combined agreements and multi-lease activations consume exactly one seat); (3) the P0340 mapping (`isTenantPlanLimitError` cause-walk, message-marker fallback for Neon HTTP where driver codes may not surface); (4) the fallback literal 10 must track `TENANT_LIMIT`; (5) pending quota atomicity deferred to D07; (6) `sample-workspace` seeding writes active leases directly without the seat guard (demo data, non-live workspaces — confirm it stays out of scope); (7) pre-existing asymmetry noticed in passing: `createLease`'s pendingTenant **Neon batch** does not accrue period charges while the node path does (C04 gap, not D04's — candidate for a later slice).
- Known limitation (unchanged from the check it replaces): the seat count does not filter `properties.deletedAt`/`units.deletedAt` — E08 owns soft-delete scoping.
- Next allowed slice: D05 fix pending-invite selection from a clean integration-branch cut.

## D05 Pending-invite selection (2026-09-06, Terra Medium review owed)

- Base: `integ/phase-a-baseline@34a6ed2c`; branch `fix/pending-invite-selection`; rollback tag `pre-pending-invite-selection`; no migration. `main` untouched.
- `findPendingInviteByEmail` now filters status `pending`, non-deleted, and unexpired invitations in SQL before `LIMIT`; it selects newest first with `createdAt DESC, id DESC`. This prevents an older accepted invitation from suppressing a newer valid tenant claim during Better Auth signup.
- `createPendingTenantInvite` uses the same valid-pending definition and deterministic ordering, so expired or soft-deleted pending rows no longer block a replacement invite. This matches D04's pending-invite quota definition.
- Regression tests: the real Better Auth signup path proves an older accepted row does not hide the newest valid pending invite; API coverage proves expired and soft-deleted rows permit a replacement invite. Test teardown removes profiles before their invitations and users.
- Verification: `db:generate` no drift; `check-types` 6/6; focused Biome clean; `db:migrate:test` passed; focused auth/invite tests 24/24; full Vitest 62 files / 351 tests + 1 conditional skip; local build 5/5. Build-generated `next-env.d.ts` changes restored.
- Terra review pointers: confirm newest-valid selection (`createdAt DESC, id DESC`) is the intended deterministic rule while D06 still owns multi-owner identity relationships; confirm expired pending rows should be re-invitable rather than merely lazily marked expired.
- Next allowed slice: D06 support existing tenants across owners, after D05 review/merge policy permits it.

## D06 Existing tenant claim (2026-09-06, Terra High review owed)

- Base: `integ/phase-a-baseline@4c84f97b`; branch `fix/multi-owner-invite-claim`; rollback tag `pre-multi-owner-invite-claim`; no migration. `main` untouched.
- Added protected `claimInvite`: the authenticated tenant may claim only an exact, pending, non-deleted, unexpired invite with the same normalized email. It reuses the owner-scoped profile prepared by the owner or creates only that relationship, then accepts only that invite. It does not alter the global user, account, password, role, or another owner's profile.
- The invite page now lets a matching signed-in session claim directly and sends other visitors to login with the invite URL as the trusted callback target. Claim errors remain on the page.
- Regression tests cover claims for multiple owners, mismatched-email refusal with no writes, and reuse of the owner-prepared profile. Verification: `db:generate` no drift; `check-types` 6/6; focused Biome clean; `db:migrate:test` passed; focused auth/invite tests 27/27; full Vitest 62 files / 354 tests + 1 conditional skip; local build 5/5.
- D08 still owns durable cross-driver acceptance atomicity and compensation. Terra review should scrutinize the claim transition's intentional use of the existing accept semantics until that slice lands.

## D07 Atomic invite creation (2026-09-06, Terra High review owed)

- Base: `integ/phase-a-baseline@760a7699`; branch `fix/atomic-invite-create`; rollback tag `pre-atomic-invite-create`; one migration. `main` untouched.
- `createPendingTenantInvite` now creates the pending invite, owner-prepared provisional user/profile, expired-row cleanup, and pending-quota check inside one node-postgres transaction or one Neon batch. Delivery remains after the durable core commits because email is an external side effect.
- Migration `0036_green_wiccan` normalizes uniqueness with a partial unique index on `(invited_by, lower(email))` for non-deleted pending invites, retires already-expired/duplicate pending rows before the index, and adds the transaction-scoped advisory-lock quota assertion used by both drivers. The migration journal timestamp was advanced past D04's hand-authored timestamp so fresh test migrations apply D07 in order.
- Regression coverage adds concurrent same-owner case-insensitive duplicate creation: exactly one invite succeeds and the loser returns `CONFLICT`; the D05 signup fixture now respects the D07 invariant while still proving an accepted invite does not hide the valid pending invite.
- Verification: `db:generate` no drift; `check-types` 6/6; focused Biome clean; fresh local `rently_test` migration passed; focused invite/tenant-limit/auth tests 37/37; build 5/5; Vitest excluding the pre-existing B10 lock-order suite passed 61 files / 349 tests.
- Full Vitest remains blocked by unrelated `group-payment-lock-order.test.ts` failures (3 B10 tests: lock serialization/race expectations and teardown after timeout). Terra review should scrutinize migration cleanup semantics, the advisory-lock quota function, and the pre-read of an existing global user before the atomic owner-prepared batch.

## D08 Atomic invite acceptance (2026-09-06, Terra High review owed)

- Base: `integ/phase-a-baseline@0ebaf20c`; branch `fix/atomic-invite-acceptance`; rollback tag `pre-atomic-invite-acceptance`; no migration. `main` untouched.
- Replaced the split transaction/manual-compensation acceptance path with one conditional SQL state transition. The invite row is claimed first; user, credential account, and owner-scoped profile writes depend on that claim in the same statement. A concurrent loser therefore performs no identity writes on either driver.
- Owner-prepared acceptance now updates only the profile linked to the exact invite and owner, preserving the global user and other owner relationships. Existing provisional credentials remain rejected; tenant-completed invites still reject an existing account.
- Regression coverage includes concurrent duplicate acceptance and asserts exactly one user, credential account, profile, and accepted invite. Existing tenant-completed, owner-prepared, consent, conflict, and expiry tests remain green.
- Verification: `db:generate` no drift; `check-types` 6/6; focused Biome clean; `db:migrate:test` passed; focused invite/auth/tenant-limit tests 38/38; build 5/5; Vitest excluding unrelated B10 lock-order and overdue-query suites passed 60 files / 348 tests.
- Full Vitest remains blocked by unrelated `group-payment-lock-order.test.ts` lock/teardown failures and `overdue-query.test.ts` timeout/period-charge teardown failures. Terra review should scrutinize CTE write dependencies, the owner-prepared profile predicate, and the behavior when a concurrent account signup races a tenant-completed acceptance.

## E01 Owner-scoped receipt profiles (2026-09-06, Terra High review owed)

- Base: `integ/phase-a-baseline@df175fcb`; branch `fix/receipt-profile-scope`; rollback tag `pre-receipt-profile-scope`; no migration. `main` untouched.
- Receipt profile lookup now joins the tenant relationship using both `tenantProfiles.userId` and `tenantProfiles.createdById = properties.ownerId`, while retaining the deleted-profile filter. Owner and tenant receipt paths therefore render the profile for the lease's property owner rather than an arbitrary shared-tenant relationship.
- Regression coverage creates two owner-scoped tenant profiles with different addresses and verifies the property owner's receipt uses its own address.
- Verification: `db:generate` no drift; `check-types` 6/6; focused Biome clean; focused receipt tests 6/6; build 5/5.

## E02 Explicit tenant-document relationships (2026-09-06, Terra High review owed)

- Base: `integ/phase-a-baseline@82fc73e1`; branch `fix/tenant-document-owner-scope`; rollback tag `pre-tenant-document-owner-scope`; no migration. `main` untouched.
- `findProfileForActor` now resolves one explicit, live owner-profile relationship: owners resolve their own (`createdById` = self) as before, tenants resolve the selected owner's relationship via a new optional `ownerId` (on `listMyDocuments` and `begin-upload`) or their earliest live relationship deterministically — never an arbitrary or soft-deleted row. New uploads on removed relationships return `NOT_FOUND` for both actors.
- Retained-document access is defined as read-only: a removed tenant's already-attached documents stay listable/downloadable by the owning owner (new fallback in `listTenantDocuments`) and downloadable by the tenant; in-flight state transitions keep their existing document-level authorization. Owner document reads additionally bind the joined profile to the owner's relationship.
- Regression coverage: shared tenant with one profile per owner (per-owner list isolation, cross-owner download refusal, tenant default + explicit selection) and removed-relationship upload blocks with retained list/download. Existing storage-key, cross-owner, procedure-guard, and Aadhaar tests stay green.
- Verification: `db:generate` no drift; `check-types` 6/6; focused Biome clean; `db:migrate:test` passed; focused tenant-document tests 6/6; build 5/5; Vitest excluding unrelated B10 lock-order and overdue-query suites passed 60 files / 350 tests.
- Full Vitest remains blocked by unrelated `group-payment-lock-order.test.ts` and `overdue-query.test.ts` failures (pre-existing, also present without this slice). Terra review should scrutinize the retained-read fallback, the earliest-relationship tenant default, and that in-flight transitions on removed relationships stay permitted.

## E03 Tenant profile context (2026-09-06, Muse Spark, branch fix/tenant-profile-context, tag pre-tenant-profile-context)

- Base: `integ/phase-a-baseline@d01d4464` (E02 merge); no migration. `main` untouched. Terra High review owed — stays `[~]` until then.
- `getMyProfile` no longer `LEFT JOIN`s one arbitrary `tenantProfiles` row onto the user. It returns global self data (`user`: name/email/phone from the `user` row) plus explicit per-owner `profiles` (`ownerId`, `ownerName`, address, emergency contacts, aadhaarLastFour, panHint), ordered deterministically, soft-deleted relationships excluded, ownerless rows dropped.
- Tenant UI (`docs-tab.tsx`) renders the header/phone from global self data and one `Address` row per owner relationship (labeled `Address (OwnerName)` when shared) instead of a single arbitrary address.
- Regression coverage (`tenant-profile-context.test.ts`, 2): shared tenant with two owners and different profile metadata returns both profiles keyed by owner; soft-deleted relationship excluded.
- Verification: `db:generate` no drift; `check-types` 6/6; Biome clean; `db:migrate:test` passed; focused profile/document/invite/removal/receipt 40/40; full suite excluding the two pre-existing blocker files 61 files / 352 tests; build 5/5.
- Full Vitest remains blocked by unrelated pre-existing `group-payment-lock-order.test.ts` and `overdue-query.test.ts` failures. Terra review should scrutinize the output-shape break (any other `getMyProfile` consumers must migrate to `user`+`profiles`) and that ownerless profile rows are dropped rather than surfaced.
## E04 GST merged-state validation (2026-09-06, Muse Spark, branch fix/gst-profile-invariant, tag pre-gst-profile-invariant)

- Base: clean `integ/phase-a-baseline@5b231688` (E03 merge); one migration `0037_left_brood`. `main` untouched. Terra Medium review owed — stays `[~]` until then. NOT pushed/merged.
- Gap proven (6 red pre-fix): the validator saw only the patch while the handler merged it over the stored row without validating the result — enabling GST without a GSTIN (fresh or partial), clearing the GSTIN while enabled, and blank GSTINs stored verbatim as `""` (the business form sends `""` for empty; 1 such row existed in `rently_dev`).
- Changed:
  - `packages/api/src/routers/rent/owner-profile.ts`: `""` normalizes to NULL; merged `gstEnabled/gstNumber` (patch over stored row) validated — enabled requires a GSTIN, stored GSTIN must match `GSTIN_PATTERN`; both update and insert paths use the merged values.
  - `packages/validators/src/owner-profile.ts`: `GSTIN_PATTERN` exported as the single source (schema + handler agree); patch-level checks unchanged.
  - `packages/db/src/schema/schema.ts` + migration `0037`: `owner_profiles_gst_enabled_check` (`gst_enabled=false OR (gst_number NOT NULL AND <> '')`); migration normalizes stored blanks first (dev-safe: 0 enabled-without-GSTIN rows). Journal `when` advanced past 0036 per the D07 precedent.
- Tests (`gst-profile-invariant.test.ts`, 10, rationale header; 6 red pre-fix): fresh enable without GSTIN (no row written), partial enable on numberless profile (stays disabled), clear-while-enabled (number kept), blank→NULL normalization, same-patch enable, partial enable with stored GSTIN, disable retains GSTIN, malformed GSTIN, 2 DB-level 23514 guards.
- Verification: `db:generate` no drift → `check-types` 6/6 → Biome clean → `db:migrate:test` (38/38 on fresh `rently_test`) → focused 10/10 + receipt 6/6 → FULL suite 64 files / 372 tests pass (incl. the two former blocker suites) → local `bun run build` 5/5; zero fixture residue; `next-env.d.ts` churn restored.
- Incidents: (1) red-run teardown leaked one API-created profile (id-list missed handler-created rows; B01 lesson) — teardown now deletes profiles by owner before users, leak removed by markers; (2) `drizzle-kit migrate` silently skipped 0037 twice — root cause is the pg migrator's skip rule (`lastDb.created_at < folderMillis(when)`): the D04/D07-era journal surgery left `rently_test`'s journal mapping scrambled, and generated `when` fell below 0036's advanced stamp. Fixed per D07 precedent (`when` → 1788720000002) and recovered with a fresh drop/create/migrate (the A02/A03 sanctioned path; also proves the CI fresh-install path). Fresh `rently_dev` impact: none (migration runs there via `db:migrate:local` at owner discretion; the 1 blank row normalizes on apply).
- No UI change needed: the GST tab already disables the switch without a GSTIN; the server now enforces it. Single writer (`upsertOwnerProfile`); utility/credit/receipt readers untouched.
- Terra review pointers: merged-vs-patch error UX (clear-while-enabled rejects instead of auto-disabling); DB CHECK covers presence only, format stays API-enforced; `when`-advance convention for future migrations.
- Next allowed slice: E05 agreement/child-lease update separation from a clean integration-branch cut.

## D03 Renewal entitlement/invoice alignment (2026-09-06, ZLM 5.3 Flash, branch fix/subscription-renewal-period)

- Base: `integ/phase-a-baseline@926c5b8c` (D02 merge); rollback tag `pre-subscription-renewal-period`; `main` untouched; **no migration** (stated explicitly — pure read/write logic change in `recordSubscriptionPayment`). Terra Medium review owed.
- Defect: the invoice derived its own period (`paidAt → paidAt + interval`) while the subscription derived the granted window independently (SQL fragments: keep the old start and extend the end on early renewal). For an early renewal the invoice therefore claimed a window (e.g. [paidAt, +1mo]) the payment did not grant (the extension [oldEnd, oldEnd+1mo]) — revenue reporting and entitlement disagreed.
- Fix: ONE effective pair computed in TypeScript (single source, replacing both the SQL fragments and the invoice's independent math): `earlyRenewal = currentPeriodEnd > paidAt`; `effectiveStart = earlyRenewal ? currentPeriodEnd : paidAt`; `effectiveEnd = effectiveStart + intervalMonths`. The invoice always records `[effectiveStart, effectiveEnd]`. The subscription keeps its shipped semantics: early renewal extends the end and keeps the row's original `currentPeriodStart` (the row describes the occupied span); a lapsed or never-set period starts at `paidAt`. `nextBillingDate = effectiveEnd`. Edge: paying exactly on the period-end day counts as lapsed (start = paidAt — no zero-length overlap).
- Tests (4 in `admin.test.ts`, rationale inline): early renewal → invoice [oldEnd, oldEnd+1mo] with the row's start kept; lapsed renewal → invoice [paidAt, +1mo] on both row and invoice; provisioned row with null period behaves lapsed; repeated renewals chain (`second.invoice.periodStart == first.invoice.periodEnd`, end extends to +1mo from that, totalPaid accumulates) — no gaps, no overlaps. Note: `paidAt` must be in the past (the "cannot be in the future" guard is real-time, so test dates sit before 2026-09-06).
- Known limitation (pre-existing, unchanged): two concurrent admin payments for the same owner with different references can both read the same `currentPeriodEnd` and double-extend — D03 aligns coverage but does not add row locking; flag to Terra whether that needs its own slice (the batch/tx split makes a node-only `for update` asymmetric with Neon).
- Gates: `db:generate` no drift → `check-types --force` 6/6 → Biome clean → full suite **61 files / 341 tests + 1 conditional skip** → build 5/5.
- Next allowed slice: D04 enforce tenant limits at activation from a clean integration-branch cut.

## D02 Atomic beta-code redemption (2026-09-06, ZLM 5.3 Flash, branch fix/beta-code-redemption)

- Base: `integ/phase-a-baseline@6e866df2` (D01 merge); rollback tag `pre-beta-code-redemption`; `main` untouched. Terra/Sol design gate deferred to owner.
- Migration **0034_kind_blindfold** (generated, no hand edits): `beta_code_redemptions` table (`code_id`/`user_id` RESTRICT FKs, audit columns) + `beta_code_redemptions_code_user_unique` — the (codeId, userId) redemption record the Fix-Plan specifies.
- `redeemBetaCode` rewritten as ONE atomic SQL statement used identically by node and Neon paths (no batch/transaction split; the dead `supportsBatch` helpers removed from the router). CTE flow: `code` (unexpired, by code text) → `claimed` (conditional counter update `total_uses < max_uses`, joined to the granted plan so an unresolvable plan means NOTHING is written — usage and entitlement cannot diverge; per-user redemption NOT EXISTS for retry idempotence) → `redemption` INSERT (ON CONFLICT (code_id, user_id) DO NOTHING — a same-user race is a no-op, not a second burned use) → `ensured` (subscription upsert, D01 index) → `updated` (entitlement on the user's exactly-one row, `current_period_end = now() + period_days`). Statement returns a status discriminator: `redeemed` / `already_redeemed` (success, plan name resolved from the granted plan) vs `not_found` (unknown/expired code) vs `unavailable` (valid code, exhausted) — both failure statuses keep the shipped NOT_FOUND UX.
- Consequence (behavior notes for Terra): the same user redeeming twice now SUCCEEDS idempotently (previously every retry burned a use and re-extended the period); the single-use `used_by_user_id` bookkeeping is preserved (set only when max_uses = 1); exhaustion for a NEW user still returns the shipped "Invalid or expired" message.
- Tests (`beta-code-redemption.test.ts`, 5, rationale header): two users racing for the final use → exactly one fulfilled, counter = 1, one redemption row, winner holds the granted plan on exactly one subscription; same-user retry succeeds with counter unchanged even past exhaustion; exhausted code refuses a new user with zero ledger movement (no subscription provisioned either); unresolvable plan writes nothing (counter 0, no redemption, no subscription) and the code remains redeemable after the plan is fixed — the "usage and entitlement commit together" pin; multi-use code counts distinct users and keeps `used_by_user_id` null. The two-user race needed per-call session mocks (mockImplementationOnce) — the static shared getSession mock made both callers the same user (C05 lesson again).
- Gates: `db:generate` no drift → `check-types --force` 6/6 → Biome clean → `db:migrate:test` → full suite **61 files / 337 tests + 1 conditional skip** → build 5/5.
- Review debt: Terra/Sol review owed. Scrutinize: (1) the plan-gated claim (an unresolvable plan silently refuses instead of crashing — the owner may prefer a loud INTERNAL); (2) the single-statement guarantee (no multi-statement batching left in this path; if someone re-adds statements, the CTE chain must stay atomic); (3) `already_redeemed` returns success even if the entitlement row was later changed by admin (re-grant is NOT reapplied on retry — retry only reads); (4) RESTRICT FKs mean beta codes with redemptions cannot be deleted (consistent with ledger discipline).
- Next allowed slice: D03 align renewal entitlement and invoice periods from a clean integration-branch cut.

## D01 One current subscription (2026-09-06, ZLM 5.3 Flash, branch fix/subscription-uniqueness)

- Base: `integ/phase-a-baseline@c9e1fab3` (C08 merge); rollback tag `pre-subscription-uniqueness`; `main` untouched. Terra High design gate deferred to owner per Fix-Plan §7.
- Migration **0033_graceful_living_tribunal** (hand-edited after generation, 0032 precedent): (1) dedupe backfill — per user, keep the newest row (`created_at DESC, id DESC` tiebreak) and DELETE the rest (invoices reference the deleted rows with ON DELETE SET NULL — duplicates carry no invoices in practice, noted for Terra); (2) `subscriptions_user_id_unique` — a FULL unique index on `user_id`, i.e. one row per user, chosen because no code path ever writes a non-active/cancelled/expired row (survey confirmed zero status-transition writers), so "one current subscription" and "one row" coincide today; D03 can evolve it.
- Idempotent provisioning: new `packages/db/src/subscription-provisioning.ts` — `ensureFreeSubscriptionSql(userId)` is a single upsert (`INSERT … SELECT FROM plans WHERE slug='free' ON CONFLICT (user_id) DO NOTHING`, table defaults carry status/interval/period) usable on node and Neon paths. Both racy creators rewired:
  - `getMySubscription` GET-time lazy creation → upsert + deterministic re-read (`createdAt DESC, id DESC` — the owner router now matches the admin definition of "current").
  - better-auth signup hook (`packages/auth/src/index.ts`) → same upsert; concurrent/replayed hook runs converge instead of duplicating.
  - The beta-redeem update-then-insert fallbacks (`subscriptions.ts:168-191`, `241-263`) are left for D02: their INSERT only fires when the user has NO rows, so the unique index cannot make them fail; D02 reworks them into the atomic claim.
- Tests (`subscription-provisioning.test.ts`, 5): five concurrent first GETs converge on one row with the same id; three concurrent upserts → one active row; a raw duplicate insert is refused (23505, cause-aware assertion); an existing subscription is returned untouched; unseeded free plan → null subscription without crashing (conditionally skipped when the shared test DB has the seeded plan). `admin.test.ts`'s deliberate historic+current fixture was rewritten as the D01 invariant pin (one row per owner; overview counts move by exactly the one row; duplicate insert refused) — the "latest row wins" semantics it pinned are now structural.
- Gates: `db:generate` no drift after the migration → `check-types --force` 6/6 → Biome clean → `db:migrate:test` (dedupe + index applied) → full suite **60 files / 332 tests + 1 conditional skip** → build 5/5.
- Review debt: Terra High. Scrutinize: (1) the dedupe DELETE keeping newest-per-user on production data (owner should check admin subscription history shrinks as expected; invoices' subscription_id nulls); (2) full-unique vs partial-unique choice and its interplay with D03 (a future CANCELLED row would block a new row — D03 must flip the index to partial or transition in place); (3) the auth hook now needs the free plan seeded or silently provisions nothing (same as before, but now also true on the GET path).
- Next allowed slice: D02 atomic beta-code redemption from a clean integration-branch cut.

## C08 Reminders/reports cutover (2026-09-06, ZLM 5.3 Flash, branch feat/rent-period-job-cutover)

- Base: `integ/phase-a-baseline@73fe704f` (C07 merge); rollback tag `pre-rent-period-job-cutover`; `main` untouched; **no migration**. Phase C is now functionally complete: the period ledger IS the production rent read.
- Writers cut over (`payment.ts`, `credit.ts`) — no lifetime read remains in any writer:
  - `createPayment` (rent): node validation uses `getLeasePeriodDue` (period outstanding + R6 headroom); accrual runs BEFORE the bound so the charge set is complete (tx rollback keeps refusals side-effect free). The Neon mirror recomputes the same bound in the balance CTE (current+past outstanding, plus `rent − future-outstanding` headroom when prepay-eligible); batch order is now lock → accrue → insert → prepay-charge → allocate → reporter.
  - **R6 prepay is LIVE**: a payment may exceed the outstanding balance by at most one future period's rent MINUS paise already prepaid into future periods (so repeated prepays can never top the next period beyond one month). `ensureNextFuturePeriodChargeSql` creates the next IST period's charge (full month only — the lease must span all of it) ONLY when the payment actually exceeds the outstanding charges (node: explicit check; Neon: gate `p.amount > outstanding`), so ordinary settlements never fabricate a future charge.
  - B10 grouped: per-lease amount = period outstanding (each lease settles ALL its arrears, not one lifetime month); B11 combined rent leg = period outstanding. Both Neon CTE mirrors rewritten to `rentOutstandingSql()`; accrual moved before the insert in both batches so the dues CTE sees the full charge set.
  - `createCredit` (rent): bound = period outstanding (node + Neon), accrual before validation.
- Readers cut over — "no production rent-due reader uses the lifetime calculation":
  - Reminders (`scheduled-reminders.ts` + `rent-cycle.ts`): rows now carry per-period `charges[{periodKey,dueDate,outstanding}]` instead of paidAmount/creditAmount. RENT_DUE fires leadDays before a charge's clamped due date when it has outstanding paise (a missing next-period charge under lazy accrual reads as full rent only when the lease provably spans that whole month); OVERDUE fires graceDays after each period's own due date — past periods never burst for a backdated lease because their exact day passed (R13 satisfied by construction, per-period claim dedupe unchanged).
  - Overdue report (`overdue-query.ts` + `overdue.ts`): `computeLeaseOverdue` aggregates every past-due charge onto the EARLIEST one (periodKey anchor, daysOverdue from it, arrears summed) — a backdated lease surfaces as ONE entry, not N. Pure read (no accrual — the nightly job owns keeping the charge set fresh). Feeds `getRevenueDashboard.overdue*` (now period-derived), `getOverdueLeases`, the in-app rent_overdue notification, and the tenants-list snapshot (C06's deferred item — tenant cards now show period arrears).
  - Exports and receipts verified clean in the survey (no rent reads at all).
- Removed: `getAmountDueForRent` + `rent-amount-due.test.ts` + the `lifetimeRentDue`/`accruedGap` fields on the balance model (C06/C07 UIs never consumed them). `getAmountDueForUtility` stays — utilities have no period ledger.
- Tests: pure suites rewritten for the new semantics (`rent-cycle` — per-period RENT_DUE/OVERDUE, dueDay-31 February clamp, month-crossing lead, pre-start skip, no-burst; `overdue` — charge-based state, reversal reopen, aggregation anchor). DB suites updated (`overdue-query` seeds charges directly so the real clock's lazy accrual cannot pollute fake dates; `signed-ledger` pours + mirrors its fixtures; `scheduled-reminders`/`atomic-individual-settlement` teardowns clear allocations→charges). B08 race expectations updated for R6: two concurrent rent payments now BOTH fulfill (second is a legal prepay; ledger absorbs both) — the invariant asserted is no over-allocation + full absorption, and beyond-cap amounts still refuse on both drivers.
- Gates: `check-types --force` 6/6 → Biome clean on all touched files (15 non-blocking warnings) → full suite **59 files / 328 tests** → build 5/5. `rently_test` residue from mid-slice failed runs was cleaned by fixture markers (Palm Residency / Ledger Property) after RESTRICT teardown failures — expected behavior of the FK discipline.
- Review debt: Terra review owed. Terra should scrutinize: (1) the R6 headroom formula (cap = rent − future-outstanding) in BOTH drivers (TS + SQL CTE) — they must stay in lockstep; (2) the batch reorders (accrual before insert; accrual side effects survive a refused insert by design — charges are owed regardless); (3) the RENT_DUE missing-charge fallback (full rent only for provably-full periods); (4) OVERDUE exact-day semantics (a missed cron day silently skips that period's notice — same as shipped behavior); (5) reminder-job accrual writes (the nightly job now mutates rent_charges via ensure).
- Next allowed slice: D01 enforce one current subscription from a clean integration-branch cut.

## C07 Tenant screens on the period read model (2026-09-06, ZLM 5.3 Flash, branch fix/tenant-period-balances)

- Base: `integ/phase-a-baseline@a78bcbc6` (C06 merge); rollback tag `pre-tenant-period-balances`; `main` untouched; no migration, no server change (the C05 model already scopes `{all:true}` to the caller's leases for tenant role). Committed file-by-file per owner instruction (6 commits). Terra review deferred to owner.
- Defect fixed (Fix-Plan C07 "tenants never see full rent as due"): Overview's "This Month's Charges" tile and My Bill's rent rows both used the full contract `leases.rent` per active unit. Both screens now build lines from the period balance read model via a new pure builder `apps/tenant/src/lib/bill-lines.ts`:
  - Rent is shown as **current period** (`currentRentDue`, labeled with the period name via `periodLabel`) and **previous periods** (`totalRentDue − currentRentDue`) as separate lines per unit — the Fix-Plan's current/older split. A fully settled unit produces no rent line at all.
  - Utility lines now include unpaid bills of **any age** (the old current-calendar-month filter hid older unpaid utilities); `amountDue` is already server-derived in `getMyUtilities`.
  - The "1st of next month" due-date guess (`nextRentDueDate`) is demoted to a fallback; the server's clamped `currentPeriodDueDate` (R3) is used whenever a charge exists.
  - Overview tile relabeled "Outstanding Balance" with Total = current + older rent + all unpaid utilities; Charge Preview card and My Bill render the same line set; WhatsApp share recomposes from it. "Monthly Rent" and "Total Paid (YTD)" tiles intentionally unchanged (contract context / payment history, not dues).
- New hook `use-tenant-balance.ts` (`{all:true}`, tenant-scoped server-side); `useSubmitReading` now also invalidates `orpc.rent.balance.key()` (a new reading creates a utility bill that changes the balance). Tenants cannot move money in the portal, so no other invalidation sites exist on this side.
- Tests (`apps/tenant/src/lib/bill-lines.test.ts`, 8, rationale header per AGENTS.md): paid rent → no line (the defect pinned), partial → remainder, credit/reversal via outstanding, current+older split, two active units with distinct states, older unpaid utility included, settled/inactive filtered, clamped due date + period label.
- Untouched on purpose: payment history tab (already uses the B12 signed ledger), reading tab (estimates are explicitly non-authoritative), receipts, profile/docs tabs, and the unused legacy `tenant-rent-due-card.tsx`/`tenant-lease-card.tsx` exports (dead code with a pre-existing paise-format bug — candidates for a cleanup slice, not this one).
- Verification: `check-types --force` 6/6 → Biome on apps/tenant clean (2 non-blocking warnings) → full suite **60 files / 327 tests** → local build 5/5; `next-env.d.ts` churn restored.
- Review debt: Terra review owed (C07 reviewer per plan: Luna then Terra Medium). Terra should scrutinize: (1) the older-outstanding derivation `totalRentDue − currentRentDue` (includes any non-current charge with outstanding paise — future prepaid charges are 0 by construction, so the split is exact); (2) utility "any age" listing — a very old unpaid bill now surfaces on My Bill, which is the point but changes what tenants see; (3) due-date fallback still guesses the 1st when no charge exists (edge: lease ended); (4) per-lease N/A — the tenant fetch is one `{all:true}` request.
- Next allowed slice: C08 cut reminders/reports over from a clean integration-branch cut.

## C06 Owner screens on the period read model (2026-09-06, ZLM 5.3 Flash, branch fix/owner-period-balances)

- Base: `integ/phase-a-baseline@7f41d8bd` (C05 merge); rollback tag `pre-owner-period-balances`; `main` untouched; no migration. Committed file-by-file per owner instruction (8 commits: server scope → hook → invalidation → dues/overdue → combined groups → tenant pending → printable bill → docs). Terra review deferred to owner.
- Server addition (small, on the C05 model): `getPeriodBalance` accepts `{all: true}` — one request returning every lease the caller's role makes visible (owner: leases on their properties; tenant: their leases; admin refused). Empty visible set on `all` returns `[]` (a new owner's dashboard is a legitimate empty state, not FORBIDDEN); specific-but-inaccessible lease/agreement stays FORBIDDEN. Regression-tested in the C05 suite (now 8 tests).
- Migrated to the read model (all now display period-aware paise, none reconstruct balances in React):
  - **Upcoming Dues** (`upcoming-dues.tsx` + new pure helper `lib/upcoming-dues.ts`): entries come from `totalRentDue`/`overdueRent`/`currentPeriodDueDate` per lease. The old "paid this month" payment-sum heuristic (which ignored credits, arrears, reversals and showed full rent) is deleted — its `overdue` urgency was actually dead code (its due-date math could never go negative). Urgency now: arrears or past-due current period → overdue; else today/soon/upcoming by the clamped due date; a ≤0 due lease drops off. Fallback for a missing current-period charge clamps client-side per R3 (no month rollover).
  - **Overdue summary card** (dashboard): `overdueCount`/`overdueAmount` now derived from the balance list (`countOverdueLeases`/`sumOverdueRent`), replacing the lifetime overdue snapshot in `getRevenueDashboard`. The dashboard and Upcoming Dues share the same `{all:true}` query (TanStack dedupe).
  - **Combined bills** (`utilities-client.tsx`): group `rentDue` is the lease's period `totalRentDue` instead of `rent − Σ(all rent payments)`. `useSuspensePayments` dropped from the utilities page entirely. Mark-combined dialog: guard for the now-legitimate zero-rent-due case (fully settled/prepaid period) instead of sending `amount: 0`.
  - **Tenant pending** (`tenant-detail-client.tsx` + `payments-tab.tsx`): Balance Summary "Pending" = Σ `totalRentDue` (was "0 if any payment this month else full monthly rent"); "Overdue Amount" card = rent arrears + past-due unpaid utilities (previously utilities only). `thisMonthBill` and `totalPaidYTD` intentionally unchanged (expectation/payment-stream stats, not balances).
  - **Printable combined bill** (`combined-bill/page.tsx`): rent line fetched via `usePeriodBalance({leaseId})` and awaited before render/print — money no longer travels through the `?rent=` URL param (link builder in `utility-detail-sheet.tsx` cleaned up too).
- Cache correctness: new `invalidatePeriodBalances(queryClient)` (invalidates `orpc.rent.balance.key()`) wired into every money-moving mutation — createPayment, createAgreementPayment, updatePayment, voidPayment (delete), voidPaymentGroup, createCredit, createCombinedBillPayment — so screens never show stale dues after recording money.
- Tests: `lib/upcoming-dues.test.ts` (9) pins each Fix-Plan C06 UI state against the read-model shapes — paid excluded, partial shows remainder, arrears overdue even when the current due date is ahead, reversal reopens, credit reduces, multi-unit ordering, month-end clamped due date (Feb 28) without drift, fallback clamp, overdue aggregation. Server all-scope test added (scoping + empty-portfolio + admin). Each test's regression rationale is in the file header per AGENTS.md.
- Deliberately NOT touched (recorded to keep C08's scope clean): `tenant-card.tsx` still renders the server-provided lifetime overdue snapshot from the tenants API; `getRevenueDashboard`'s internal overdue computation, reminders, exports, and stats remain lifetime (C08 cuts those readers over); payments-page collection cards are payment-stream sums, not balances, so they stay. During the dual-write phase the settlement commands remain lifetime-bounded server-side — for a backdated lease the combined dialog can now show a period rent due larger than the lifetime bound the server will accept (the server error names the lifetime amount; C08 removes the divergence).
- Verification: `db:generate` no drift → `check-types --force` 6/6 → Biome on all 16 changed files clean (15 non-blocking style warnings, 1 info — pre-existing categories) → full suite **58 files / 319 tests** → local build 5/5; `next-env.d.ts` churn restored.
- Review debt: Terra review owed (C06 reviewer per plan: Luna then Terra Medium). Terra should scrutinize: (1) the `{all:true}` scoping (empty-portfolio semantics, admin refusal); (2) the rent-only combined fallback now sending a period-aware amount against a lifetime-bounded writer (documented divergence until C08); (3) the Overdue card's definition change (lifetime snapshot → period arrears) — numbers will differ on divergent histories; (4) `thisMonthBill`/`totalPaidYTD` left payment/expectation-based on purpose; (5) invalidation coverage (credit reversal has no dashboard hook — check the credit note screen path).
- Next allowed slice: C07 tenant financial screens from a clean integration-branch cut.

## C05 Server balance read model (2026-09-06, ZLM 5.3 Flash, branch feat/period-balance-read-model)

- Base: `integ/phase-a-baseline@963e7801`; rollback tag `pre-period-balance-read-model`; `main` untouched. **No migration** (read-only slice — stated explicitly per plan; `db:generate` reports no drift). Terra review deferred to owner.
- New helper `packages/api/src/routers/helpers/period-balance.ts` — `getLeasePeriodBalances(db, leaseIds)` is the one owner/tenant-safe model. Per lease it returns: per-period charges (`amount/allocated/outstanding/isPaid/isOverdue/isFuture`, C02 sign convention: outstanding = amount − Σallocations), period identity (`currentPeriodKey` IST R2, `currentPeriodDueDate` clamped R3, snapshotted from the charge row), `currentRentDue`, `overdueRent`, `totalRentDue`, the compatibility `lifetimeRentDue` (reuses `getAmountDueForRent`), `accruedGap = totalRentDue − lifetimeRentDue` (the visible backdated gap; 0 for current-period leases), `credits` (net rent-scoped bill_credits + credit allocations), `paid` (lifetime = signed ledger via `getSignedLedgerPayments` with B12 link/fallback attribution, rent-only, deposits/utility excluded; period = signed payment-allocation stream), and `utilities` (per-bill due via `getAmountDueForUtility`, total clamps negatives at 0).
- Design decision for Terra: **accrual-before-read**. The read model runs `ensureAccruedChargesSql({leaseId})` (C04's idempotent ON CONFLICT DO NOTHING statement) before reading, because C04's lazy accrual means a lease idle across a month boundary has no current-period charge yet; R2–R5 define accrual from lease dates alone, so a pure read would report a false zero. Reads therefore carry one idempotent write side effect during the dual-write phase.
- `overdueRent`/`isOverdue` semantics: outstanding > 0 AND charge due date < IST today AND due date ≥ lease start date — the last guard is R3's shipped `overdue.ts:53` skip ("a lease beginning after its period's due date is not overdue for that period") generalized; the snapshot due date of a first-period charge can legally precede `startDate` (dueDay before start day). Arrears stay visible in `totalRentDue` regardless (R9).
- New procedure `getPeriodBalance` (`packages/api/src/routers/rent/balance.ts`, GET `/rent/balance/period`, registered as `rentRouter.balance`). Input: exactly one of `leaseId`/`agreementId`. `protectedProcedure` with in-handler role scoping: owner → leases on `properties.ownerId = caller`; tenant → `leases.tenantId = caller` (an agreement read returns only the caller's own leases — the shared-tenant boundary); admin/other roles → FORBIDDEN (no supervisory financial access). Agreement scope returns ALL leases of the agreement, terminated included (R9 arrears stay collectible). NOT wired into any existing screen, endpoint, reminder, or export — C06/C07 own screen migration, C08 owns cutover.
- Tests (`packages/api/src/routers/test/period-balance-read-model.test.ts`, 7, rationale header per AGENTS.md): partial payment + rent discount + unpaid utility in one model (lifetime/period/credits/paid reconcile, accruedGap 0); backdated lease (start last month, dueDay 10) → previous-month arrears overdue, current not-yet-overdue split, accruedGap = RENT; prepaid future period (fixture-inserted since writers refuse advances) → future charge isFuture/isPaid, not overdue, totalRentDue 0, lifetime reads −RENT and gap absorbs it; multi-unit agreement read with distinct per-lease states; void reopens the charge and nets both paid streams to 0; E01-class scoping (owner↔owner cross-property refusals incl. shared tenant's other-owner lease, tenant own-leases-only, admin refused); accrual-before-read restores a deleted current-period charge. Fixture cleanup: allocations → charges → credits → payments → utilities → leases → agreements → units → profiles → users; two green repeat runs, zero C05-marker residue.
- Test-infra note: the shared `getSession` mock is module-global — per-call `asSession()` selection is required; creating "per-owner clients" silently points earlier clients at the last owner (this bit once: an owner's `createLease` ran as the other owner → confusing FORBIDDEN).
- Gates in order: `db:generate` no drift → `check-types` 6/6 → focused Biome clean (13 non-blocking `noNonNullAssertion` warnings in the test file) → `db:migrate:test` → focused 7/7 (×2) → full suite **58 files / 309 tests** → local build 5/5; `next-env.d.ts` churn restored. Full-suite env quirks unchanged (needs `RESEND_API_KEY` in env; fileParallelism stays false).
- Environment incidents this session, both recorded for the owner:
  1. **Near-miss, no mutation:** running `bunx drizzle-kit migrate` directly (without `DRIZZLE_ENV=test`) loads `apps/server/.env` and targets **production Neon**. Verified read-only afterwards: prod's last migration row is 2026-09-05T20:59 (before this session), the run applied zero pending migrations, and prod already contains the Phase C tables (`rent_charges` 57 rows, `rent_allocations` 50, `rent_backfill_exceptions` 13) — i.e. the owner has already deployed the C02/C03 migrations. Lesson: never invoke drizzle-kit except through the env-scoped bun scripts (`db:migrate:test` / `db:migrate:local`).
  2. `db:migrate:test` failed/hung spuriously: the Docker `pg_db_local_rently` container was stopped. `docker start pg_db_local_rently` fixed it; no stale locks this time.
- Review debt: Terra review owed before any `[x]` or `main` rollup. Terra should scrutinize: (1) the accrual-on-read write side effect and its idempotency; (2) the isOverdue pre-start guard vs the snapshotted due dates; (3) agreement scope returning terminated leases; (4) admin FORBIDDEN on a financial read; (5) `accruedGap` sign conventions (negative lifetime under advances); (6) N+1 reads (`getAmountDueForRent`/`getAmountDueForUtility` per lease/bill) — acceptable at current scale, flag if screens hammer it.
- Next allowed slice: C06 owner financial screens from a clean integration-branch cut.

## C04 Rent-period dual-write (2026-09-06, ZLM 5.3 Flash, branch feat/rent-period-dual-write)


- Base: `integ/phase-a-baseline@ee13193b`; rollback tag `pre-rent-period-dual-write`; `main` untouched; no migration (per plan). Terra review deferred to owner.
- New helper `packages/api/src/routers/helpers/rent-period.ts`: single-statement SQL usable identically in node transactions and Neon batches — `ensureAccruedChargesSql` (per lease or per agreement, optional existence gate so a suppressed Neon insert has zero side effects), `allocateRentPaymentsSql` (source-WHERE parameterized: by payment id or payment group; cumulative-interval FIFO pour, C02 sign convention), `allocateRentCreditSql`, `mirrorPaymentReversalSql` / `mirrorPaymentGroupReversalsSql` / `mirrorCreditReversalSql`, and `reportUnallocatedRentPaymentRemaindersSql` (divergent-history remainders → exception rows, never dropped).
- Writers wired (all atomic within their existing tx/batch):
  - `createLease` / `createCombinedLease`: explicit lease ids + charge accrual at creation (R13 — a backdated start owes elapsed periods immediately). Found and fixed a real trap here: drizzle's `$defaultFn` ids are NOT accessible app-side, so explicit ids are required before referencing the lease in batch statements.
  - `createPayment` (rent): validation relaxed from `amount === due` to `amount > due` rejects (C01 R8 partial payments live; advances still refused — message updated); dual-write appended to the node tx and the Neon batch (Neon rent CTE gate `=` → `>=`); utility exact-balance rule untouched.
  - `createAgreementPayment` (B10) and `createCombinedBillPayment` (B11): accrue + allocate per group, rent legs only for the combined command.
  - `voidPayment` / `voidPaymentGroup`: reversal mirrors negate the original's allocations; idempotent via the (payment_id, charge_id) unique index.
  - `createCredit` (rent-scoped) / `reverseCredit`: credit allocations and mirrors; reverseCredit retry path now self-heals a missing mirror.
- Test suite (`rent-period-dual-write.test.ts`, 9): accrual at creation incl. prorated backdated start (IST-oracled), full payment → both ledgers zero, partial payment reconciled, advance refused with zero writes, discount FIFO + sign inversion, void reopens, credit reversal restores, group settlement delta-contract on a backdated combined agreement, combined-bill rent-leg-only allocation. Reconciliation helper: `getAmountDueForRent` must equal `Σ charges − Σ allocations` on current-month-start leases.
- Legacy suites updated (mechanical): 11 test files now clear `rent_charges`/`rent_allocations` before their lease/credit/payment deletes — the RESTRICT foreign keys make incomplete teardown loud (this surfaced as ~104 cross-suite failures until each file's cleanup order was corrected: allocations → charges → payments → utilities → leases). payment-type-invariant additionally deletes allocations keyed by untracked payments.
- Real edge fixed: proration can floor to 0 paise for sub-paise-per-day rents (a leaked B02 boundary lease with rent=1) — 0032 and the ensure helper now use `GREATEST(1, round(...))`. Note: 0032 was amended post-merge on this branch (pre-deployment; the file had not run anywhere but local test DBs).
- Gates: `check-types` 6/6 → Biome clean → full suite 57 files / 302 tests → build 5/5. No migration in this slice; `db:generate` no drift.
- Review debt: Terra review owed. Known limitation: absolute lifetime==period equality holds only for leases created in the current period; pre-C04 histories reconcile per-operation delta only (the accrual gap is the documented Phase-C subject).
- Next allowed slice: C05 server balance read model from a clean integration-branch cut.

## C03 Historical rent-period backfill (2026-09-06, ZLM 5.3 Flash, branch feat/rent-period-backfill)

- Base: `integ/phase-a-baseline@f7a4642b`; rollback tag `pre-rent-period-backfill`; `main` untouched. Sol review deferred to owner (Terra/Sol pass later, as with B11/C02).
- Survey of the production-shaped `rently_dev` (read-only, dump pre-B01 at migration 24): 13 leases, 53 rent payments, 8 reversals, zero rent-scoped credits; 5 seed leases whose historical payment totals exceed any deterministic charge set; one terminated lease with no end date. These shapes drove the exception design.
- Changed (one migration `0032_curvy_argent`, hand-authored after the generated DDL):
  - `rent_backfill_exceptions` table (declared in schema.ts; CREATE IF NOT EXISTS with inline FKs so the file re-runs) — kinds: `lease_end_ambiguous`, `unallocated_source_remainder`, `unattributable_reversal` (the last is a dead-man's switch: B03's CHECK makes unlinked reversals impossible post-0025).
  - Charges: one per lease per period active, through the current IST month for ongoing leases, prorated at edges (`round(rent × activeDays / dim)`), due date = min(rentDueDate or start-day, month length) snapshotted. Date math uses the stored wall-clock date part (G01 formalizes TZ later).
  - FIFO allocation via cumulative-interval overlap: charges and flows each occupy paise ranges per lease; the overlap is the allocation. Sources: positive rent payments (business date order) + rent-scoped discount credits; reversals mirror their original's allocations negated (B03/B12 attribution, referenceNumber fallback).
  - Exceptions recomputed from scratch each run; everything else ON CONFLICT DO NOTHING → fully idempotent.
- Tests (`packages/db/src/rent-period-backfill.test.ts`, 7): period+due-date exactness for ended and ongoing leases (IST-oracled), prorated edges with lifetime overpayment → exception (72,581/24,194 vs 150,000 collected), void-then-repay mirroring reopens July, credit FIFO alongside payments, ambiguous terminated lease → exception, idempotent re-run, reconciliation (no over-allocated charges; leftover flows all listed).
- **fileParallelism: false** added to vitest.config.ts — test files share one DB and the backfill re-run mutates global rows; parallel files raced (observed: C02 suite failures when run alongside C03). Within-file concurrency (B04/B05/B10 races) unaffected.
- Live proof (rently_dev untouched, confirmed still at migration 24): snapshot → disposable postgres:18.6 container on :5433 → full pending migration sequence applied cleanly → 61 charges / 57 allocations / 14 exceptions (1 ambiguous-end, 13 remainders totaling ₹57,060 — the seed leases) → **zero over-allocated charges** → paise-exact reconciliation (flows 86,870,000 = stream allocations 81,164,000 + reversal mirrors −440,000 + exceptions 5,706,000) → 0032 re-run changed nothing (61/57/14) → probe destroyed.
- Gates: `db:generate` no drift → `check-types` 6/6 → Biome clean → `db:migrate:test` → focused 13/13 (with C02 suite) → full suite 56 files / 293 tests → build 5/5.
- Review debt: Sol design gate + final review owed. Known limitation: charges apply each lease's current `rent` to its whole history (rent edits were never modeled); "today" at migration time fixes ongoing-lease accrual — later periods are C04's writers.
- Next allowed slice: C04 dual-write rent operations from a clean integration-branch cut.

## C02 Rent charges and allocations schema (2026-09-06, ZLM 5.3 Flash, branch feat/rent-period-schema)

- Base: `integ/phase-a-baseline@9c3cbbf3`; rollback tag `pre-rent-period-schema`; `main` untouched. Owner pre-deferred the Sol/Terra design gate (reviews later, as with B11).
- Scope honored: additive schema only — the tables have NO writers yet (C04 dual-writes; C08 cutover). Live readers/writers untouched; the lifetime calculation remains authoritative until then.
- Changed (one migration `0031_open_human_fly`):
  - `rent_charges`: one row per lease per IST period (`YYYY-MM`, format CHECK), unique `(lease_id, period_key)`, positive paise `amount`, `due_date` (date, string mode) snapshotted per charge with a CHECK that it falls inside the period. Implements C01 R2/R3/R4/R5.
  - `rent_allocations`: `charge_id` + exactly-one-source CHECK (`payment_id` XOR `credit_id`), nonzero signed `amount` meaning "settles the charge" (payment rows mirror their sign — reversals arrive negative; credit rows invert bill_credits sign). Partial unique indexes: one allocation per source row per charge. RESTRICT FKs to charges/payments/bill_credits keep settled history undeletable. Outstanding = `amount − sum(allocations)`; over-allocation is writer-enforced (B08/B10 pattern), not a row CHECK. Implements C01 R7/R8 partially (writers in C04).
- Tests (`packages/db/src/rent-period-schema.test.ts`, 6, DB-level, minimal per AGENTS.md — regression rationale in the file header): control (partial payment + discount settle a charge to zero), duplicate charge/period 23505, malformed charges 23514 (amount/format/due-date-in-period), allocation source XOR + zero-amount 23514, duplicate source-per-charge 23505, source delete RESTRICT 23001. Direct SQL inserts, full fixture teardown.
- Verification: `db:generate` → 0031, re-run no drift → `check-types` 6/6 → Biome clean → `db:migrate:test` → focused 6/6 → full suite 55 files / 286 tests → build 5/5 (next-env churn restored).
- Known limitations: charges/allocations are deliberately empty in production until C03 backfill + C04 dual-write; over-allocation and charge lifecycle (creation on lease activation, backdated registration) are C04 writer concerns; prepay cap (C01 R6) is also a writer rule.
- Review debt: Sol/Terra design gate + final review owed before any `[x]` or `main` rollup.
- Rollback: revert the C02 commit or drop the two tables (they are empty until C04 turns writers on); migration is additive only.

## C01 Rent-period business rules (2026-09-06, ZLM 5.3 Flash, branch docs/rent-period-rules)

- Base: `integ/phase-a-baseline@e2b9ad6`; rollback tag `pre-rent-period-rules`; docs-only slice (no code, no migration, no tests per plan).
- Output: `docs/Rent-Period-Rules.md` — the Phase C contract. Owner approved every decision point on 2026-09-06 (recorded in `docs/Decisions.md`): IST calendar-month periods; due-day clamping without carry-over; PRORATED first and last periods (`round_half_up(rent × activeDays ÷ daysInMonth)`); arbitrary partial payments allocated FIFO oldest-period-first; prepay allowed up to 1 future period beyond outstanding (cap); backdated lease registration creates all elapsed-period charges as immediate arrears settled FIFO (the owner's real scenario); termination accrues through the endDate period but arrears stay collectible; renewal is a new lease row.
- Key consequences handed to later slices: C02 schema needs per-period charges + per-allocation rows + prepay cap; C03 backfill prorates edge periods and routes ambiguous dates to an exception report; C04 stages the first API contract change (partial amounts behind the dual-write); C08 must suppress the overdue-notice burst for pre-registration periods of backdated leases.
- Verification: N/A (docs-only; worked examples in the doc are the checkable behavior). `check-types`/build unaffected.
- Next allowed slice: C02 (design gate Sol High preferred) from a clean integration-branch cut.

## B11 One atomic combined-bill command (2026-09-06, ZLM 5.3 Flash, branch feat/atomic-combined-settlement)

- Base confirmed: clean `integ/phase-a-baseline@600d99af`; rollback tag `pre-atomic-combined-settlement` created before work; `main` was not used or modified. Owner pre-authorized implement→commit→push→merge into integ and deferred the Terra High design gate until after implementation (owner re-verifies with Terra).
- Gap: the dashboard's `MarkCombinedPaidDialog` fired `createPayment` plus one `recordUtilityPayment` per bill through `Promise.all` — a mid-flight failure left earlier legs committed as a partial settlement outside any group, and each leg emailed its own receipt.
- Changed (no migration — reuses B09's group-level idempotency metadata on `payment_groups`):
  - `packages/validators/src/payment.ts`: `CreateCombinedBillPaymentSchema` — `leaseId`, `utilityIds` (1–10, uuid), group payment metadata, one required `idempotencyKey`; callers never supply amounts.
  - `packages/api/src/routers/rent/payment.ts`: new `createCombinedBillPayment` (POST `/rent/payment/create-combined-bill-payment`). Resolves lease + owner + agreement in one scoped query (missing agreement fails loudly). Replay/fingerprint before balance math via the shared B09 helpers; combined fingerprint covers leaseId + sorted utilityIds + metadata. Node path: lease row lock first, then selected utilities `for update` ordered by id, same-key replay re-checked in-lock, dues recomputed via `getAmountDueForRent`/`getAmountDueForUtility`, group + rent/utility allocations inserted, `isPaid` synced. Neon path: batch of [lease advisory lock] + [utility advisory locks ordered by id] + [one conditional CTE statement: recompute rent due (B10 SQL mirror) and per-utility dues, gate group+allocation inserts on matched-count and all-utility-dues-positive, update `is_paid`]; 23505 → replay adoption. Rent leg is conditional (included iff due > 0); every named utility must have due > 0 or nothing is written. One grouped receipt (`sendAutomaticAgreementPaymentReceipt`) after commit, skipped on replay. No notification (the old legs created none). Both drivers share the lock order, so combined and individual settlements serialize identically.
  - `apps/dashboard/src/components/features/utilities/mark-combined-paid-dialog.tsx`: one `useIdempotencyKey` per dialog open replaces per-leg keys; submit calls the single mutation (server-derived amounts; success toast reports the committed allocation sum, not the client estimate). Rent-only edge (all utilities already settled client-side) still routes through `createPayment`. A failed command leaves the dialog open with the same key for retry.
- Tests (`combined-bill-atomic.test.ts`, 11): per the new AGENTS.md test policy each test maps to a contract — one command = one group with server-derived legs + one post-commit receipt; failed leg writes nothing (foreign-lease bill; already-settled bill) with a fresh-key retry succeeding; same-key retry returns the winner's group without a second receipt; reused key with a different bill set conflicts; rent already settled yields a utility-only group; combined-vs-individual concurrency has no over-settlement — on both node-postgres and the Neon batch shim. A 12th case (nonexistent utility) was removed as redundant with the foreign-lease gate per the new "explain what regression it prevents" rule (rationale recorded in the file header).
- Verification: `db:generate` no drift (B11 needs no migration — stated explicitly) → `check-types` 6/6 → focused Biome clean → `db:migrate:test` → focused 11/11 (12/12 stable across 3 runs pre-trim) → full suite 54 files / 280 tests → local build 5/5. `next-env.d.ts` churn restored; B11 fixture rows fully removed from `rently_test` (earlier aborted teardown runs had leaked tracked rows; cleaned by the B11 Owner/Tenant markers; older non-B11 residue from previous slices' runs left untouched).
- Environment notes: the local full-suite run needs `RESEND_API_KEY` in env (the local `.env.test` line is commented out; `packages/email` constructs Resend at import time — confirmed pre-existing at base 600d99af via throwaway worktree, not caused by B11; do not modify `.env.test`). The invite.test "combined agreement payment" case logs mock-missing-export stderr from the B10 receipt path — pre-existing noise, tests unaffected.
- Review debt: Terra High design gate + final review remain required before any `[x]` or `main` rollup (owner will run Terra verification). Terra should start from the "Terra review pointers" block in the Fix-Plan B11 entry — it lists the decisions made without the gate, the hand-maintained SQL mirrors, lock-order parity, the untested combined-vs-`createAgreementPayment` race, and the test trim.
- Rollback: revert the B11 commits or restore `payment.ts`/`mark-combined-paid-dialog.tsx`/`payment.ts` (validators) to `pre-atomic-combined-settlement`; no schema changes to roll back.

## B10 Recompute grouped allocations after locking (2026-09-05, Muse Spark, branch fix/group-payment-lock-order)
- Base confirmed: clean `integ/phase-a-baseline@fa131704`; rollback tag `pre-group-payment-lock-order` created before work; `main` was not used or modified.
- Bug: `createAgreementPayment` computed every allocation via `getAmountDueForRent(db, …)` before the node-postgres transaction took its `for update` locks, and before the Neon batch entirely — a concurrent individual rent payment (or a second distinct-key grouped request) could interleave, and the group then inserted stale pre-lock balances (lease overpaid, net negative due). Pre-fix red evidence: 5/8 new race tests failed (both distinct-key grouped races double-inserted; the grouped-vs-individual races both wrote).
- Changed (no migration), `payment.ts` only:
  - Node path: the transaction now takes an ordered `select … for update` over the agreement's active leases FIRST (this locking read is the authoritative post-lock active-lease set), re-runs the same-key replay check inside the lock (a winner that committed while waiting is adopted), recomputes allocations via `getAmountDueForRent(tx, …)`, validates all dues > 0, then inserts group + children.
  - Neon path: batch of [advisory locks on every active lease — same `rently:settlement:lease:` key domain as individual settlements, ordered by id] + [one conditional CTE statement: recompute per-lease due (rent + non-utility credits − signed rent ledger, mirroring `getAmountDueForRent` incl. B12 link/fallback reversal attribution), gate group+allocation inserts on `lease_count >= 2 AND all_positive`]. Empty result → same-key replay adoption attempted, else BAD_REQUEST; 23505 catch unchanged. Child ids use core `gen_random_uuid()` (payments.id has no DB default; precedent in migration 0000/auth tables).
  - Legacy pre-lock reads remain only as fast-fail (<2 active leases) and notification-recipient lookups.
- Behavior notes: a distinct-key grouped request racing a winner now rejects with BAD_REQUEST (zero dues) instead of double-inserting; a same-key loser adopts the winner's group on every path, including inside the node lock.
- Tests first (`group-payment-lock-order.test.ts`, 8): node/neon distinct-key grouped race, node/neon grouped-vs-individual race, node/neon same-key adoption, sequential post-settlement recompute control, neon rent-credit balance recheck. 5 red pre-fix; 8/8 stable across 5 repeat runs post-fix.
- Verification: `db:generate` no drift → `check-types` 6/6 → focused Biome clean → `db:migrate:test` → focused 8/8 → full suite 267/267 → local `bun run build` 5/5. Zero fixture leaks in `rently_test` (verified by marker query); `next-env.d.ts` churn restored.
- Review debt: Terra High design gate and final review remain required before any `[x]` or `main` rollup.
- Rollback: revert the B10 commit or restore `payment.ts` to `pre-group-payment-lock-order`; no schema changes to roll back.

## E05 Agreement/child-lease update separation (2026-09-06, Muse Spark, branch fix/agreement-term-ownership, tag pre-agreement-term-ownership)

- Base: clean `integ/phase-a-baseline@5b231688` (E03 merge; E04 still unmerged on its own branch). No migration. `main` untouched. Terra High design gate deferred per owner batch-review policy — stays `[~]`. NOT pushed/merged.
- Gap proven (red pre-fix): `updateLease` wrote dates onto ONE child row while the parent agreement and sibling children kept the old terms — a single-child edit silently diverged combined agreements. Second pre-existing divergence: even independent date edits never reached the parent agreement.
- Shared-field definition: the agreement owns `startDate`, `endDate`, `rentDueDate`, `notice`, `description`; children duplicate them at creation. Unit-owned (never propagated): `unitId`, `rent`, `deposit`, `status`, `referenceId`.
- Changed:
  - `packages/validators/src/lease.ts`: `AgreementSelectSchema` + `UpdateAgreementSchema` (5 shared fields, date-order + due-day 1-31 refines).
  - `packages/api/src/routers/rent/lease.ts`: `updateLease` refuses date patches on multi-child agreements (`BAD_REQUEST`, "update the agreement instead") and propagates them to the parent of single-child agreements in the same atomic op (appended last in batch so positional destructuring is untouched; mirrored in the tx path). Agreement-less legacy rows keep current behavior. New `updateAgreement` (PATCH `/rent/lease-agreement/update`): owner-scoped via agreement→property join (NOT_FOUND/FORBIDDEN, deleted-property filtered), merged date validation with explicit-null-clears-end semantics, updates parent + ALL children (`WHERE agreementId`) in one tx/batch; auto-wired into `rentRouter` via the namespace export.
- Tests (`agreement-term-ownership.test.ts`, 8, rationale header; 4 red-precise pre-fix + 2 Neon added after): two-unit agreement update (parent + both children), single-child shared-term refusal (nothing changes), independent propagation (child + parent, the compat pin), cross-owner FORBIDDEN (nothing written), merged date-order refusal, legacy agreement-less edit still works, plus both propagation paths on the Neon batch shim.
- Test-infra note: the Neon shim needed the D04 column-mapper upgrade (camelCase + UTC timestamp parsing — naive `new Date(str)` shifts +05:30); B11's raw shim only fits raw-SQL entries, not builder queries. The Neon tests caught a real `children is not iterable` shape bug pre-fix.
- Verification: `db:generate` no drift → `check-types` 6/6 → Biome clean (import sort + format autofixed, diff confirmed to touch only new regions) → `db:migrate:test` → focused 8/8 + lease-adjacent (tenant-limit, financial-input, profile-context) 37/37 → FULL suite 64 files / 370 tests pass → local `bun run build` 5/5; zero fixture residue; `next-env.d.ts` churn restored.
- Known limitation / Terra pointers: (1) no dashboard UI for `updateAgreement` yet — the single-lease edit form gets `BAD_REQUEST` on date edits for combined children (H05-class follow-up; error message points at the agreement); independent leases keep working via propagation. (2) `rentDueDate`/`notice`/`description` were creation-duplicated but never child-editable, so no live divergence vector — `updateAgreement` now owns them. (3) `terminateLease` touches status+unit only, out of scope. (4) Scrutinize: single-child propagation vs force-updateAgreement, and the `WHERE agreementId` child fan-out (no per-child auth needed — siblings share the agreement's owner by construction).
- Next allowed slice: E06 reactivation status-only from a clean integration-branch cut.

## E06 Reactivation status-only (2026-09-06, Muse Spark, branch fix/lease-reactivation-invariant, tag pre-lease-reactivation-invariant)

- Base: clean `integ/phase-a-baseline@66d60a3` (E05 merge); no migration. `main` untouched. Terra High review owed — stays `[~]`. Standing authorization applies (no per-step approval).
- Gap proven (2 red pre-fix): `updateLease` let a terminated→active transition carry rent/deposit/date changes — the active-lease money guard only fired when status was already active, so reactivations silently repriced closed leases.
- Changed (`packages/api/src/routers/rent/lease.ts` only): a reactivation patch carrying rent, deposit, startDate, endDate, or referenceId is refused (`BAD_REQUEST`, "Reactivation cannot change lease terms"). The `reactivating` predicate moved up to the guard site and is reused by the D04 seat check below. Conflict protection, seat check, E05 date propagation (now unreachable during reactivation by construction), and status-only reactivations are untouched — verified by the existing callers (dashboard sends status-only; D04/B02 tests use status-only or expect BAD_REQUEST already).
- Tests (`lease-reactivation-invariant.test.ts`, 4, rationale header; 2 red pre-fix): money rewrite refused with lease still terminated and rent intact, date rewrite refused with dates intact, conflict protection pinned (second active lease on the unit → CONFLICT, first stays terminated), status-only reactivation succeeds with terms intact and unit re-occupied.
- Verification: `db:generate` no drift → `check-types` 6/6 → Biome clean → `db:migrate:test` → focused 4/4 + lease-adjacent (reactivation, tenant-limit, financial-input, agreement-ownership) 39/39 → FULL suite 66 files / 384 tests pass → local `bun run build` 5/5; zero fixture residue; `next-env.d.ts` churn restored.
- Terra pointers: the refused set (rent/deposit/dates/referenceId) vs status — confirm nothing legitimate reactivates with extra fields; guard order (E06 fires before E05 propagation and merged-date validation, so a reactivating date patch reports status-only, not date-order).
- Next allowed slice: E07 unit-status derivation from a clean integration-branch cut.

## E07 Unit occupancy derivation (2026-09-06, Muse Spark, branch fix/unit-status-derivation, tag pre-unit-status-derivation)

- Base: clean `integ/phase-a-baseline@f0bba6b9` (E06 merge); no migration. `main` untouched. Terra High review owed — stays `[~]`. Standing authorization applies.
- Gap proven (1 red pre-fix): `updateUnit` accepted a `status` patch, so one call could mark a leased unit available behind the lease lifecycle's back.
- Survey: all other `units.status` writers are lifecycle transitions (create occupy, terminate/update/remove release, reactivation occupy); no cron expires leases; sample-workspace seeding is consistent by construction (4 active leases on 4 occupied units); dashboard forms never send status; only B02 tests call updateUnit (baseRent only). Preflight on production-shaped `rently_dev`: zero contradictions in either direction — no repair migration needed (plan allows zero).
- Changed (`packages/validators/src/unit.ts` only, no handler change): `status` removed from `UpdateUnitSchema` pick and re-declared as `z.never().optional()` — a forbid-key. Rationale: oRPC validates (and zod strips unknown keys) before the handler, so a handler-level `"status" in data` guard is unreachable dead code (tried first, proven by a passing-then-failing test); the schema refusal surfaces as `BAD_REQUEST` with "Unit occupancy is derived from leases."
- Tests (`unit-status-derivation.test.ts`, 4, rationale header; 1 red pre-fix): direct status patch on a leased unit refused with unit still occupied; terminate→available→reactivate→occupied cycle; combined agreement frees only the terminated child; ordinary baseRent/description edit on an occupied unit still works (compat pin).
- Verification: `db:generate` no drift → `check-types` 6/6 → Biome clean → `db:migrate:test` → focused 4/4 + adjacent (financial-input, tenant-removal, reactivation) 28/28 → FULL suite 67 files / 388 tests pass → local `bun run build` 5/5; zero fixture residue; `next-env.d.ts` churn restored.
- Terra pointers: forbid-key (`never().optional()`) vs strict mode (strict would reject all unknown keys — deliberately not chosen); no DB trigger — cross-table invariant rests on the closed write path plus zero-contradiction preflight; confirm `removeTenant`'s bulk terminate+release stays classified as lifecycle.
- Next allowed slice: E08 soft-delete boundaries from a clean integration-branch cut.

## E08 Live-resource scoping (2026-09-06, Muse Spark, branch fix/live-resource-scoping, tag pre-live-resource-scoping)

- Base: clean `integ/phase-a-baseline@c0ecbf2a` (E07 merge); no migration (`db:generate` no drift, stated explicitly). `main` untouched. Terra Medium review owed — stays `[~]`. Standing authorization applies.
- Gap proven (7 red pre-fix, each resolving instead of rejecting): `createUnit` accepted an archived property, `updateProperty` edited one, `VerifyUnitOwnership` ignored the property flag, `isLeaseOwner`/`VerifyLeaseOwnership` ignored both flags (so `createPayment` settled a historical lease under archived resources), `createLease`/`createCombinedLease` accepted archived units, and `getUnits` listed deleted units of live properties.
- Already filtered (left untouched): `getLeaseWithOwner` (update/terminate/get paths), `listLeases`, `getLeaseById`, `updateAgreement` (E05), `listProperties`, `listUtilities`, payment list, reminder/overdue/admin reads.
- Changed (7 commits, `0c652d7`..`46e1dda`):
  - `helpers/index.ts`: `VerifyUnitOwnership` + property filter; `VerifyLeaseOwnership`/`isLeaseOwner` + both filters — centrally covers updateUnit, deleteUnit, createPayment, createUtility, batch utilities, recordUtilityPayment, createCredit, reverseCredit.
  - `unit.ts`: createUnit property lookup filters archived; getUnitById + property filter; listUnits + property filter.
  - `property.ts`: updateProperty filters archived (NOT_FOUND, row unchanged); getUnits ownership check filters archived (NOT_FOUND) and lists only live units.
  - `lease.ts`: createLease/createCombinedLease unit lookups filter archived units/properties (matched-count shortfall → FORBIDDEN).
  - `utility.ts`: getOwnedUtility + both filters (update/get/record paths).
  - `payment.ts`: getOwnedPayment + both (update/get/void); createAgreementPayment + property filter; createCombinedBillPayment + both; voidPaymentGroup + property filter.
- Tests (`live-resource-scoping.test.ts`, 7, rationale header; 7 red pre-fix): create under archived property, update archived property, live-unit-under-archived-property (surgical — reachable pre-fix via createUnit) across update/get/list, lease on archived unit, combined naming archived unit, settlement on API-archived historical lease (terminate→deleteUnit→deleteProperty, zero payments written), deleted-unit filtering + archived-property NOT_FOUND on getUnits. Teardown sweeps API-created units/agreements/leases by fixture scope (B01 lesson); red-run residue cleaned by markers, zero `@test.keyhq.invalid` users after.
- Decisions recorded (D04-adjacent risk resolved — NOT fixed): the `rently_assert_tenant_seat` count still ignores deleted flags because active-on-deleted is unreachable via API (deleteUnit refuses active leases, deleteProperty refuses live units, E08 closes creation/reactivation) and any surgical row would fail closed (counted seat refuses more, never over-admits). Changing it needs a migration for zero reachable effect. `removeTenant` bulk terminate+release stays lifecycle (E07 classification); tenant-portal reads of the tenant's own lease stay unfiltered (active-on-deleted unreachable; C07 UX untouched); voids/reversals inherit refusal through the same gates (archived = closed books).
- Verification: `db:generate` no drift → `check-types` 6/6 → Biome clean (format/import autofix, diff confirmed to touched regions) → `db:migrate:test` → focused 5-file 24/24 → FULL suite 68 files / 395 tests pass → local `bun run build` 5/5; zero fixture residue; `next-env.d.ts` churn restored.
- Terra pointers: FORBIDDEN vs NOT_FOUND split (helper-boolean paths report FORBIDDEN, lookup paths NOT_FOUND — same as cross-owner semantics); getOwnedUtility/getOwnedPayment now NOT_FOUND historical single-reads under archived resources (receipt/export surfaces untouched); confirm the D04 non-fix reasoning and the closed-books reading of voids under archived resources.
- Next allowed slice: E09 unit-number uniqueness from a clean integration-branch cut.

## E09 Live unit-number uniqueness (2026-09-06, Muse Spark, branch fix/unit-number-uniqueness, tag pre-unit-number-uniqueness)

- Base: clean `integ/phase-a-baseline@1bfd83ec` (E08 merge); one migration `0038_overconfident_pestilence`. `main` untouched. Terra High review owed — stays `[~]`. Standing authorization applies.
- Gap proven (4 red pre-fix): two live units in one property could share a unitNumber through create, rename, raw insert, and concurrent double-create — bills, leases, and readings could name an ambiguous unit.
- Preflight on production-shaped `rently_dev`: 14 live units, zero `(property_id, unit_number)` duplicates — migration dev-safe, no repair needed.
- Changed (4 commits, `0403ec0`..`63a3f49`):
  - `schema.ts` + migration `0038`: partial unique index `units_property_number_live_unique` on `(property_id, unit_number)` WHERE `deleted_at IS NULL` — the database arbitrates races; archiving frees the number (the plan's approved reuse semantics).
  - `unit.ts`: createUnit/updateUnit map 23505 to CONFLICT ("A live unit with this number already exists in this property") via a cause-aware `violationCode` (utility.ts precedent); PK collisions are impossible with generated ids, so catch-only is precise and race-safe.
  - Journal surgery per D07/E04 precedent: generated `when` fell below 0037's hand-advanced stamp, so the entry was added surgically (`when` → 1788720000003, minimal diff) — proven by a fresh drop/create/migrate (39/39 in order, index present).
- Seeding safe: sample-workspace upserts units by id with distinct numbers per property, so re-seeding cannot trip the index.
- Tests (`unit-number-uniqueness.test.ts`, 6, rationale header; 4 red pre-fix): same-property duplicate refused with count pinned at 1, cross-property reuse (scope control), reuse after archive (approved-semantics pin), rename onto a live sibling refused with number intact, raw duplicate 23505, concurrent double-create (exactly one succeeds, loser CONFLICT).
- Verification: `db:generate` no drift (×2) → `check-types` 6/6 → Biome clean → `db:migrate:test` + fresh-install proof → focused 44/44 (incl. payment-export/receipt regression-adjacent) → FULL suite 69 files / 401 tests pass → local `bun run build` 5/5; zero fixture residue; no `next-env.d.ts` churn this time.
- Terra pointers: partial (reuse-after-archive) vs full uniqueness — confirm the approved reading; exact-match (case-sensitive) numbers; catch-only 23505 mapping with no pre-check query.
- Next allowed slice: F01 notification recipients from a clean integration-branch cut.

## F01 Notification recipients (2026-09-06, Muse Spark, branch fix/notification-recipient-model, tag pre-notification-recipient-model)

- Base: clean `integ/phase-a-baseline@349e6c97` (E09 merge); no migration. `main` untouched. Terra Medium review owed — stays `[~]`. Standing authorization applies. Small test footprint per owner request (2 tests).
- Gap proven (2 red pre-fix): `createCombinedLease` and `createAgreementPayment` addressed their notifications to the tenant, but every read path (`list/unread-count/mark-read/mark-all`) is owner-only and the tenant app has no notification surface — those rows were visible to nobody. All other writers (invite-accepted ×2, meter-reading, lazy expiry/overdue, seeds) already address the owner.
- Decision (this slice's scoped call, Terra to confirm): both events concern the owner's books, so both rows are addressed to the acting owner with owner-facing copy; no tenant read surface added, no audience/type columns needed. Alternatives recorded: a tenant notification surface (procedures + bell UI — larger slice), or deleting the writes (B11 precedent — loses the record).
- Changed (3 commits, `25dfedc`..`21f5d64`): lease.ts (owner + "covering N units" copy), payment.ts (owner, tenant-lookup fallback chain deleted).
- Tests (`notification-recipients.test.ts`, 2): combined-lease and agreement-payment rows appear in the owner's bell with zero rows addressed to the tenant. Teardown clears allocations before group payments (C04 RESTRICT lesson).
- Verification: `db:generate` no drift → `check-types` 6/6 → Biome clean → `db:migrate:test` → FULL suite 70 files / 403 tests pass → local `bun run build` 5/5; zero fixture residue; `next-env.d.ts` churn restored.
- Next allowed slice: F02 notification deduplication from a clean integration-branch cut.

## F02 Notification deduplication (2026-09-06, Muse Spark, branch fix/notification-deduplication, tag pre-notification-deduplication)

- Base: clean `integ/phase-a-baseline@6630be48` (F01 merge); one migration `0039_strange_naoko`. `main` untouched. Terra High review owed — stays `[~]`. Standing authorization applies. Small test footprint per owner request (3 tests).
- Gap proven (2 red pre-fix): lease-expiry dedupe checked UNREAD rows only, so read-then-poll recreated the row; nothing arbitrated concurrent inserts (pinned via a raw duplicate probe — concurrent polls serialize on this driver). The overdue path already keyed the current period without an isRead filter.
- Preflight on production-shaped `rently_dev`: exactly one duplicate pair (read + recreated `lease_expiring_soon`, 2h apart — the bug in the wild). Migration repairs before constraining: keep earliest `(created_at, id)` per identity, then the partial unique index. Repair proven on a scratch clone (deleted the recreated row, kept the read row; scratch destroyed). `rently_dev` itself untouched.
- Changed (4 commits, `7b92b2c`..`1fd5a7b`):
  - `schema.ts` + migration `0039`: partial unique `notifications_dedupe_key` on `(user_id, type, entity_id, entity_type)` WHERE both entity columns NOT NULL — identity is user/type/entity/period, never isRead; entity-less rows stay repeatable by design.
  - `notification.ts`: expiry dedupe drops the `isRead=false` predicate (any row suppresses); both lazy inserts gain target-less `onConflictDoNothing` so a race loser writes nothing and the poll reads the winner's row.
  - Journal surgery per D07/E04/E09 precedent (`when` → 1788720000004, surgical edit) — proven by fresh drop/create/migrate (40/40 in order, index present).
- Tests (`notification-deduplication.test.ts`, 3): read-then-poll creates no second row, 4 concurrent polls converge on one row + raw duplicate refused 23505, old-period overdue row doesn't suppress the current period (exactly one new row).
- Verification: `db:generate` no drift → `check-types` 6/6 → Biome clean → `db:migrate:test` + fresh-install proof → FULL suite 71 files / 406 tests pass → local `bun run build` 5/5; zero fixture residue; `next-env.d.ts` churn restored.
- Terra pointers: earliest-wins repair (keeps the read row — history preserved, unread copy dropped); entity-less rows exempt from dedupe; a lease whose endDate is extended after notification stays suppressed (no re-notify); target-less DO NOTHING swallows any conflict on those inserts by design.
- Next allowed slice: F03 reminder retry claiming from a clean integration-branch cut.

## F03 Reminder retry claiming (2026-09-06, Muse Spark, branch fix/reminder-retry-claim, tag pre-reminder-retry-claim)

- Base: clean `integ/phase-a-baseline@10db84b4` (F02 merge); no migration. `main` untouched. Terra High review owed — stays `[~]`. Standing authorization applies. Small test footprint per owner request (2 tests).
- Gap proven (deterministic red `['claimed', 'claimed']`): a FAILED delivery older than 1h became retry-eligible, but the reclaim UPDATE was unconditional — two simultaneous workers both re-claimed and both sent. Job-level concurrency could not pin it (two full runs serialize on this driver, 5/5 green pre-fix), so the test gates the reclaim unit directly: a query gate holds the first reclaim UPDATE until both workers pass the eligibility read.
- Changed (2 commits, `7a4c4a0`..`d71aa7f`, `scheduled-reminders.ts` only + test): the reclaim is one conditional statement (still `failed` AND `updated_at < now() - 1h`); a loser matches zero rows → duplicate. `claimDelivery` exported as the test seam. The app-side age pre-check stays as a fast path; the WHERE clause is the arbiter.
- Tests (`reminder-retry-claim.test.ts`, 2): gated concurrent reclaim (exactly one claimed, stable 3/3 post-fix), retry only after the 1h delay (early run duplicates, aged run claims+sends once).
- Verification: `db:generate` no drift → `check-types` 6/6 → Biome clean → `db:migrate:test` → FULL suite 72 files / 408 tests pass → local `bun run build` 5/5; zero fixture residue; `next-env.d.ts` churn restored.
- Terra pointers: DB-clock `now()` vs app-clock `Date.now()` for the 1h rule (both workers share the DB); attemptedAt untouched on reclaim; the exported seam.
- Next allowed slice: G01 India business dates from a clean integration-branch cut.

## G01 India business dates (2026-09-06, Muse Spark, branch fix/india-business-dates, tag pre-india-business-dates)

- Base: clean `integ/phase-a-baseline@56b12d55` (F03 merge); no migration. `main` untouched. Terra Medium review owed — stays `[~]`. Standing authorization applies.
- Gap: browser today-defaults used the UTC calendar date (`new Date().toISOString().split("T")[0]`), so 00:00–05:30 IST an owner recording "today" got yesterday — while the API, jobs, and reports key by IST. Server IST machinery (`getLocalDateKey/PeriodKey`, period SQL, date-only keys) surveyed correct and left untouched: UTC-midnight parsing of `YYYY-MM-01` always lands on the same IST date (+05:30), and stored timestamps use the UTC-part convention consistently on both sides.
- Changed (11 commits): `toBusinessDateKey(now, tz=Asia/Kolkata)` in `validators/src/date.ts` (en-CA parts, explicit zone — locale-independent); 9 today-default call sites across dashboard (payment/utility forms, receipt dialogs, utility fallbacks, lease/payment buttons) and tenant reading tab. Stored-date display arms (`new Date(stored)…`) deliberately untouched — they round-trip the stored convention correctly.
- Surveyed and left (recorded): server-local windows in `admin/overview` (rolling 30d range, not a business date), UTC entitlement math in `admin/subscriptions`, UTC demo seeding, tenant docs-tab timestamp. None defines a tenancy business date.
- Tests (`business-date.test.ts`, 4): IST 00:00–05:30 window, month/year boundaries, day 29–31 + leap day, locale independence — green under default TZ and `TZ=Pacific/Kiritimati`.
- Verification: `db:generate` no drift → `check-types` 6/6 → Biome clean → `db:migrate:test` → FULL suite 73 files / 412 tests pass → local `bun run build` 5/5; zero fixture residue (27-user residue from two timeout-killed runs cleaned by marker cascade); `next-env.d.ts` churn restored.
- Environment note: full vitest stalled twice back-to-back (~600s timeouts, killed); background re-run passed 73/412 in 173s. The killed runs' fixtures were the residue source — never leave killed-suite rows behind.
- Terra pointers: one-helper reading (UI uses validators, server keeps rent-cycle — same rule, no behavior churn); `?? ""` remnants after a total helper (harmless); lazy `useState(() => …)` initializer change.
- Next allowed slice: G02 meter-reading precision from a clean integration-branch cut.

## G02 Meter-reading precision and bounds (2026-09-06, Muse Spark, branch fix/meter-reading-validation, tag pre-meter-reading-validation)

- Base: clean `integ/phase-a-baseline@ffc1df67` (G01 merge); no migration. `main` untouched. Terra High review owed — stays `[~]`. Standing authorization applies. Small test footprint per owner request (4 tests).
- Gap proven (2 red pre-fix): tenant readings were `.int().max(500)` — fractional values rejected (the UI already parses floats) and cumulative meters past 500 kWh unusable. No jump check existed; decreasing was handler-enforced but untested.
- Changed (2 commits, `e526a1c`..`c742b2b`, `tenant-portal.ts` only + test): schema drops `.int()`/`.max(500)` (keeps `.min(0)`); new `MAX_MONTHLY_READING_DELTA = 2000` kWh per-submission cap via `plausibleUnitsUsed` (throws past the cap, returns 2dp-rounded consumption), wired into both batch and tx branches next to the untouched decreasing check. No UI change (no client cap; server enforces) and no owner-path change (B02 bounds already, no absolute cap there).
- Tests (`meter-reading-validation.test.ts`, 4): fractional accepted with exact stored values, cumulative 600→650 accepted, 2400 kWh jump refused with no bill written, decrease refused (the two refusal pins stay green pre-fix by design — they guard the cap removal).
- Verification: `db:generate` no drift → `check-types` 6/6 → Biome clean → `db:migrate:test` → FULL suite 74 files / 416 tests pass → local `bun run build` 5/5; zero fixture residue; `next-env.d.ts` churn restored.
- Terra pointers: confirm the 2000 kWh delta against real metering data (named constant, no migration by plan); 2dp rounding of consumption vs exact fractional storage; decreasing-check message untouched.
- Next allowed slice: G03 meter-reading chronology from a clean integration-branch cut.

## G03 Meter-reading chronology (2026-09-06, Muse Spark, branch fix/meter-reading-chronology, tag pre-meter-reading-chronology)

- Base: clean `integ/phase-a-baseline@e0ae3d24` (G02 merge); no migration. `main` untouched. Terra High review owed — stays `[~]`. Standing authorization applies. Small test footprint per owner request (3 tests).
- Gap proven (3 red pre-fix): the previous-reading lookup took the globally latest bill (a backdated submission compared against a later bill and refused); the batch path checked-then-inserted the monthly guard with no arbitration. No unique index by design: dev holds a legitimate paid correction pair in one month that must never be deleted (deletion would rewrite financial history).
- Changed (2 commits, `0c84024`..`8541ecc`, `tenant-portal.ts` only + test): previous = latest bill strictly before the submitted date on both paths (later bills keep stored values — ledger rows are never rewritten); batch-path insert is one `INSERT…SELECT…WHERE NOT EXISTS (same-month bill)` statement, zero rows → CONFLICT (tx path keeps its FOR UPDATE serialization). Raw SQL needs an app-side `crypto.randomUUID()` (bypasses drizzle id defaults — caught by test).
- Tests (`meter-reading-chronology.test.ts`, 3): backdated accepted+chained, later bill ignored for previous selection, gated concurrent same-month submits on the batch shim (exactly one wins — the gate forces the overlap; job-level concurrency serializes like F03).
- Verification: `db:generate` no drift → `check-types` 6/6 → Biome clean → `db:migrate:test` → FULL suite 75 files / 419 tests pass (background run; foreground stalls documented) → local `bun run build` 5/5; zero fixture residue (scratch-debug leaks cleaned by ids); `next-env.d.ts` churn restored.
- Terra pointers: backdated bills chain forward-only (a later bill's stored previousReading is NOT recomputed — rewrites are forbidden); month granularity of the guard; single-statement SQL mirror to review; shim timestamp-key extension for utility date keys.
- Next allowed slice: G04 meter-reading rate limits from a clean integration-branch cut.

## G04 Meter-reading rate limits (2026-09-06, Muse Spark, branch fix/meter-reading-rate-limit, tag pre-meter-reading-rate-limit)

- Base: clean `integ/phase-a-baseline@3c288326` (G03 merge); one migration `0040_chief_wallow`. `main` untouched. Terra Medium review owed — stays `[~]`. Standing authorization applies. Small test footprint per owner request (3 tests).
- Gap proven (2 red pre-fix, both `TOO_MANY_REQUESTS`): the limiter counted every utility bill on the tenant's leases in the last hour, so 5 owner-created bills locked the tenant out — same lease and cross-lease.
- Changed (6 commits): `submission_source` nullable text + CHECK on utilities (no backfill — legacy/seed rows stay NULL and fail open); tenant submit marks `'tenant'` on both drivers; `createUtility`/`createBatch` mark `'owner'`; limiter adds `= 'tenant'`; validators omit the internal column from responses (idempotencyKey precedent). Generated journal `when` already exceeds 0039's — no surgery this slice. Fresh-install proof via `db:migrate:test` on the existing flow (40 migrations applied in order during verification).
- Tests (`meter-reading-rate-scope.test.ts`, 3): 5 owner bills + tenant submit succeeds (same lease and cross-lease), 5 tenant submits + 6th refused (limiter still bites).
- Verification: `db:generate` no drift (×2) → `check-types` 6/6 (caught a missing select column — fixed via the omit, zero handler churn) → Biome clean → `db:migrate:test` → FULL suite 76 files / 422 tests pass (background run) → local `bun run build` 5/5; zero fixture residue; `next-env.d.ts` churn restored.
- Terra pointers: enum-vs-actor choice (source only; lease already identifies the tenant); NULL fail-open for legacy rows; owner marking covers create/batch but not seeds.
- Next allowed slice: H01 server-issued statements from a clean integration-branch cut.

## H01 Server-issued statements (2026-09-06, Muse Spark, branch fix/server-issued-statements, tag pre-server-issued-statements)

- Base: clean `integ/phase-a-baseline@8abd8364` (G04 merge); one migration `0041_far_toad`. `main` untouched. Terra High review owed — stays `[~]`. Standing authorization applies. API tests only (5); UI wiring verified by build + existing dialog test.
- Gap proven (4 red pre-fix of 5 — the totals test needed the procedures to exist): `/combined-bill?ids=` rendered any named bills as one bill. Receipts, credit notes, single-utility, and tenant receipt pages resolve single server-scoped IDs — surveyed safe, untouched.
- Changed (9 commits): `bill_statements` (owner/lease/utilityIds/periodKey/expiresAt, cascading, 7-day TTL); `issueBillStatement` locks one-lease-one-month via `getOwnedUtility` per bill (unknown/foreign/archived refuse); `getBillStatement` checks owner+expiry as NOT_FOUND and resolves amounts live; `getOwnedUtility` moved verbatim to `helpers/owned-utility.ts` (router modules may only export Procedures — caught by check-types); page renders `?statement=` server data only; dialog issues then opens the statement link via the plain orpc client (relative import — root vitest maps `@/` to apps/web, and no React Query provider exists in the dialog test).
- Tests (`bill-statements.test.ts`, 5): server-computed totals, mixed tenants, mixed periods, cross-owner issue/read, expired/invalid ids.
- Verification: `db:generate` no drift → `check-types` 6/6 → Biome clean → `db:migrate:test` → FULL suite 77 files / 427 tests pass (background run; caught a real `@/`-in-tested-file breakage post-first-green) → local `bun run build` 5/5; zero fixture residue; `next-env.d.ts` churn restored.
- Terra pointers: 7-day TTL; composition locked at issue but amounts resolved live at read (voids reflect; later bills never join); period month keyed IST; bill number derived from statement id server-side.
- Next allowed slice: H02 utility overdue summaries from a clean integration-branch cut.

## H02 Utility overdue summaries (2026-09-06, Muse Spark, branch fix/utility-due-summary-ui, tag pre-utility-due-summary-ui)

- Base: clean `integ/phase-a-baseline@2aa6ccfc` (H01 merge); no migration. `main` untouched. Luna High review owed per plan (UI presenting financial totals — Terra Medium after) — stays `[~]`. Standing authorization applies.
- Gap: summaries summed gross totals and trusted the stale `isPaid` flag — page stats counted partial settlements at full value, rows badged off the flag, tenant overdue/this-month sums ignored payments, share text quoted gross.
- Changed (5 commits): `lib/utility-summary.ts` (settled = due ≤ 0, outstanding floored, collected = total + credits − due paid portion, rate capped 100) + 4 tests; wired into pageStats, table-row badge/action gating, tenant thisMonthBill/overdueAmount, WhatsApp share text. Relative lib imports (H01 lesson: root vitest maps `@/` to apps/web). Cards, dialogs, detail sheet, and single-bill page already derived correctly — untouched.
- Tests (`utility-summary.test.ts`, 4): discount, partial (paid portion only), reversal reopen, over-credit clamp.
- Verification: `db:generate` no drift → `check-types` 6/6 → Biome clean → `db:migrate:test` → FULL suite 78 files / 431 tests pass (background run, 305s) → local `bun run build` 5/5; zero fixture residue; `next-env.d.ts` churn restored.
- Luna/Terra pointers: collected-portion definition (discounts are not collections); thisMonthBill now nets payments (expectation → due semantics change); share text shows clamped due.
- Next allowed slice: H03 financial cache invalidation from a clean integration-branch cut.

## H03 Financial cache invalidation (2026-09-07, Muse Spark, branch fix/financial-query-invalidation, tag pre-financial-query-invalidation)

- Base: clean `integ/phase-a-baseline@67738729` (H02 merge); no migration. `main` untouched. Terra Medium review owed — stays `[~]`. Standing authorization applies (5 file-by-file commits, each pushed, merged as `90eb4b7f`). Small test footprint per owner request (3 mapping tests, no UI mounts).
- Survey (C06 `invalidatePeriodBalances` covered only `rent.balance`): `listTenants` carries a server-derived `overdue` snapshot per lease yet NO money mutation invalidated it (tenant cards went stale after any payment); `useCreateCredit` missed revenue (Net discounts card) and tenants; `useRecordUtilityPayment` (which writes a payment row) refreshed only the utility list; utility-bill create/update/remove/batch never touched balances although the C05 model carries a utilities section; credit reversal has no dashboard mutation hook at all (API-only — confirmed by repo-wide grep), so nothing to wire. `getDashboardStats` needs nothing (counts only; lifecycle hooks own it); `listLeases` carries contract terms, not dues.
- Changed (net −40 lines across call sites):
  - `lib/financial-invalidation.ts` (new): `invalidateFinancialViews(queryClient)` — payments, utilities, credits, tenants, revenue dashboard, plus period balances via the C06 helper. Header documents the mapping, the two deliberate exclusions, the bill-op/tenant/credit-reversal carve-outs.
  - `lib/financial-invalidation.test.ts` (new, 3): all six views invalidated; prefix keys (filtered lists refresh); dashboard stats excluded.
  - `use-period-balance.ts`: `@/utils/orpc` → relative (root vitest maps `@/` to apps/web — H01 lesson; keeps the new test's import chain alias-free).
  - Payment hooks (×5), createCredit, combined-bill dialog: bespoke subsets replaced with the helper (detail keys stay at call sites). Utility-bill ops (×8 plain+optimistic) gain balance invalidation; recordUtilityPayment gains the full set.
- Verification: `db:generate` no drift → `check-types` 6/6 → Biome clean (1 import-sort autofix) → `db:migrate:test` → focused 24/24 → FULL suite 79 files / 434 tests pass (background run) → local `bun run build` 5/5; zero `@test.keyhq.invalid` residue; `next-env.d.ts` churn restored.
- Terra pointers: uniform over-invalidation (a rent payment now also refetches utility/credit lists when mounted — refetch-only-if-mounted, accepted for drift-proofing); bill ops use balances-only while money moves use the full set (documented in the helper header); confirm credit-reversal needs no hook until a UI surface exists.
- Next allowed slice: H04 cash-refund semantics (Terra High design gate) from a clean integration-branch cut.

## H04 Cash-refund semantics (2026-09-07, Muse Spark, branch fix/credit-refund-semantics, tag pre-credit-refund-semantics)

- Base: clean `integ/phase-a-baseline@b5a70eef` (H03 merge); no migration. `main` untouched. Terra High review owed — stays `[~]`. Standing authorization applies (4 file-by-file commits + docs, pushed, merged as `05d56b3c`). Small test footprint per owner request (5 API tests).
- Product decision (owner, asked before implementing per Muse rules): `appliedAs` was a behavior-free label — a "Refund (cash back)" credit only reduced the due with no cash movement (5 such rows, −₹3,900, exist in dev). Owner chose: refund only when the bill is already paid; unpaid bills get a reduction action with proper naming. Discounts on unpaid bills lower the displayed due immediately (H02 derivations already net credits — confirmed to owner as correct); the payment later settles the reduced amount.
- Changed:
  - `rent/credit.ts`: `createCredit` gates the pairing on both drivers — refund requires a settled bill (`due/outstanding <= 0`) and is bounded by collected totals (utility: bill total + prior credits − due; rent: gross accrued charges via new `chargedTotal` on `getLeasePeriodDue`); adjust keeps the existing outstanding bound (which already refuses reductions on settled bills). Neon CTEs gate atomically in-statement; tx path locks first. Distinct refusal messages per case.
  - `helpers/period-balance.ts`: additive `chargedTotal` on `LeaseSettlementBound` (all existing destructuring safe).
  - `discount-dialog.tsx` (sole credit dialog; rent credits are API-only): mode-locked — settled bill shows "Refund (cash back)" + "Record refund", otherwise "Reduce bill" + "Create credit note"; the appliedAs select is gone (server still re-validates).
- Tests (`credit-refund-gate.test.ts`, 5, rationale header; 4 red-precise pre-fix): refund refused on unpaid utility/rent bills with zero rows written; refund succeeds on paid utility/settled rent; adjust still refused on a paid bill (existing-bound control).
- Verification: `db:generate` no drift → `check-types` 6/6 → Biome clean → `db:migrate:test` → focused 24/24 (gate + reversal + idempotency) → FULL suite 80 files / 437 pass + 2 env-contention timeouts in untouched files (`period-balance-read-model`, `tenant-limit-activation` — both green in isolation 16/16 in 2.5s) → local `bun run build` 5/5; fallout residue (C05/D04 markers only, zero H04) cascade-cleaned, final zero; `next-env.d.ts` churn restored.
- Incidents: (1) Lefthook pre-push `biome-changed` blocked twice on a format error in the new fallback block — fixed via `biome check --write` (formatter authoritative); (2) a manual indent "fix" edit reported success but did not change the file — trusted the formatter output instead.
- Terra pointers: Neon CTE paths are hand-mirrored and unexecuted locally (B08 precedent — needs a Neon branch or review read); the rent refund bound is gross charges, loose by prior-discount amounts; revenue does NOT net refunds (no cash-outflow payment row — the remaining option-B half, needs its own designed slice if wanted); negative utility dues from refunds stay clamped in displays (H02); legacy `refund` rows keep rendering as before.
- Next allowed slice: H05 payment action states from a clean integration-branch cut.

## H05 Payment action states (2026-09-07, Muse Spark, branch fix/payment-action-states, tag pre-payment-action-states)

- Base: clean `integ/phase-a-baseline@1d364b6d` (H04 merge); no migration. `main` untouched. Luna High review owed per plan — stays `[~]`. Standing authorization applies (4 file-by-file commits, pushed, merged as `8a90a372`). Small test footprint per owner request (6 component tests, no API tests — server void semantics already pinned by B04/B05 suites).
- Gap (2 red pre-fix): cards offered Void on already-reversed originals (server absorbs it as an idempotent no-op since B04, so the click was pointless); rows offered it too, and no surface labeled a voided original (only a missing Paid badge). Reversal rows were already mostly safe (card hid Void, row trigger disabled but menu item still mounted).
- Changed: card hides Void for reversed originals and shows a `Voided` badge (destructive tint, adjustments-tab precedent); row drops the actions menu entirely when nothing is actionable (`canVoid = !isReversal && !isReversed`) and shows the same badge — hide chosen over disable (no dead disabled trigger); trigger gained `aria-label="Payment actions"` (testability + a11y); page-level `reversedPaymentIds` prefers the authoritative B03 `reversesPaymentId` link with `referenceNumber` fallback for legacy rows; detail dialog (no void action there) gains the Voided badge for labeling.
- Tests (`payment-action-states.test.tsx`, 6, jsdom + testing-library, relative imports per H01 root-vitest rule, plain assertions — no jest-dom in repo): card actionable/reversal/voided-original, row menu offered/absent, badge presence. Base UI menu opens under fireEvent in jsdom (verified).
- Verification: `db:generate` no drift → `check-types` 6/6 → Biome clean (test file needed tab-format `--write`) → `db:migrate:test` → focused 11/11 (states + export dialog) → FULL suite 81 files / 443 pass + 2 B10 lock-order race timeouts under load (pre-existing flake pattern; 8/8 green alone in 1.5s; H05 touches no API code) → local `bun run build` 5/5; zero residue; `next-env.d.ts` churn restored.
- Luna pointers: hide-vs-disable choice on the row menu; link-preferred voided detection (legacy fallback retained); detail-dialog badge added beyond the plan's row/card test list (untested, same pattern).
- Next allowed slice: H06 private document cache lifecycle from a clean integration-branch cut.

## H06 Private document cache lifecycle (2026-09-07, Muse Spark, branch fix/private-document-cache-lifecycle, tag pre-private-document-cache-lifecycle)

- Base: clean `integ/phase-a-baseline@4eb28fbe` (H05 merge); no migration. `main` untouched. Luna High review owed per plan — stays `[~]`. Standing authorization applies (5 file-by-file commits, pushed, merged as `73d7ea70`). Small test footprint per owner request (8 cache-lifecycle tests, no DB).
- Gap: preview object URLs sat in a module-level Map nobody cleared — logout never revoked, viewer close kept entries, no lifetime bound. A second login in the same tab (no reload between sessions) would be served the previous session's bytes for the same document id. Both app logouts hard-reload today, but silent session swaps (expiry → client-side re-login) and replaced documents hit the same hole.
- Changed:
  - `packages/ui` cache module: entries carry timestamps with a 15-min TTL (stale drops refetch; dropped without revoke since an open viewer may still display — its close path owns revocation); timestamped bans so loads completing after revoke/logout are revoked immediately instead of re-caching (closes the close-during-load and logout-during-load races); `clearPreviewCache`/`revokePreviewUrl` semantics kept.
  - Dashboard + tenant viewers: `closeViewer` revokes on close, unmount effect revokes an open preview, session-user-change effect clears the cache — via stable module imports (no dep churn).
  - Dashboard + tenant logouts: `clearPreviewCache()` on success before redirect. Admin/web untouched (no preview viewers there — blobs can only exist where the cache module is used).
- Tests (`use-private-document-url-cache.test.ts`, 8, rationale header; TTL + 2 race tests red pre-fix): fresh caching, concurrent dedupe, failure retry, logout-clear with next-session refetch (the plan's acceptance scenario), per-viewer revoke isolation, TTL refetch without revoking a possibly-displayed URL, late completion dropped after close and after logout.
- Verification: `db:generate` no drift → `check-types` 6/6 → Biome clean → `db:migrate:test` → FULL suite 82 files / 451 pass + the same 2 B10 lock-order load-timeout flakes (green alone 8/8; untouched code) → local `bun run build` 5/5; zero residue; `next-env.d.ts` churn restored.
- Incidents: (1) Lefthook commit hook blocked repeatedly — first a hook-in-test-helper lint (fixed via a single-line-suppressed `testCache` factory; multi-line suppression comments break adjacency), then the real find: commitlint `subject-case` rejects uppercase starts ("TTL-bound" → reworded; earlier silent failures were `tail -1` hiding this error — always read full hook output). (2) A stacked `git commit` swept the whole staged index — history repaired via soft reset into per-file commits.
- Luna pointers: 15-min TTL value; stale-evict-without-revoke reasoning; ban-map pruning (per-doc on next access); hide-vs-clear on admin/web logouts (deliberately untouched); `PrivateDocumentViewer` itself unchanged.
- Next allowed slice: H07 avatar deletion from a clean integration-branch cut.

## H07 Avatar deletion (2026-09-07, Muse Spark, branch fix/avatar-delete-state, tag pre-avatar-delete-state)

- Base: clean `integ/phase-a-baseline@eae757f5` (H06 merge); no migration. `main` untouched. Terra Medium review owed — stays `[~]`. Standing authorization applies (3 file-by-file commits, pushed, merged as `d26954da`).
- Gap (4 red pre-fix): the server deleted the R2 object but left `user.image` to a second client-side `updateUser` write — any failure between the two left a visibly stale avatar (DB pointing at a deleted object). Non-OK store responses were also swallowed as success.
- Changed:
  - `routers/upload.ts`: store failure (non-OK) and unreachable storage throw `INTERNAL_SERVER_ERROR` with the reference kept (retry-safe, idempotent); `user.image` cleared server-side (`db.update`, `updatedAt` bumped) only after the object is gone. S3 DELETE idempotence means missing objects follow the success path. Scope-check and no-image no-op untouched.
  - `use-upload-avatar.ts`: delete flow drops the redundant client-side reference rewrite and refreshes the session (`authClient.getSession()`) so the UI drops the photo.
- Tests (`avatar-delete.test.ts`, 5, rationale header; 4 red pre-fix, no-op control green): delete clears the reference with one DELETE call; missing object succeeds and clears; store 500 and network failure keep the reference with INTERNAL; repeat delete is a no-op without store traffic. R2 signed via real AwsClient crypto, `fetch` stubbed; image URLs built from the same `R2_PUBLIC_URL` env the handler uses.
- Verification: `db:generate` no drift → `check-types` 6/6 → Biome clean → `db:migrate:test` → FULL suite 83 files / 457 pass + 1 D04 reactivation load-timeout flake (green alone 8/8; untouched code) → local `bun run build` 5/5; zero residue; `next-env.d.ts` churn restored.
- Terra pointers: retry is client-toast-driven (no auto-retry/backoff — deletion is idempotent so manual retry is safe); orphan objects can never be referenced (only unreferenced bytes, invisible); `getSession` refresh staleness if that call itself fails (self-heals on next navigation).
- Next allowed slice: H08 financial route protection from a clean integration-branch cut.

## H08 Financial route protection (2026-09-07, Muse Spark, branch fix/financial-route-protection, tag pre-financial-route-protection)

- Base: clean `integ/phase-a-baseline@d3be0ff3` (H07 merge); no migration. `main` untouched. Terra Medium review owed — stays `[~]`. Standing authorization applies (5 file-by-file commits, pushed, merged as `0b53b56c`).
- Gap (2 red pre-fix): dashboard `/combined-bill`, `/receipts/*`, `/credit-notes/*` were absent from `PROTECTED_ROUTES` (direct navigation reached the page shell); tenant `/receipts/*` lives outside the `/tenant-portal` prefix its proxy guards, so tenant receipts had no routing-layer protection at all. Payments/utilities/subscription sections were already prefix-covered.
- Changed:
  - `packages/auth/src/route-access.ts` (new): pure `resolveRouteAccess` (public passthrough, no-cookie/verfied-fail → login+callback, allowed role → allow, tenant/owner/admin → their homes, unknown → web home) + `isProtectedPath` prefix matcher. Both proxies rewired through it with behavior parity (prefetch bypass, cookie fast-path without fetch, GOTCHA comments kept).
  - Dashboard `EXTRA_PROTECTED_ROUTES` += the three document routes; tenant `TENANT_PROTECTED_ROUTES = ["/tenant-portal", "/receipts"]` (the old dashboard-shaped `PROTECTED_ROUTES` copy in tenant navigation.ts is dead — proxy never read it — left untouched, noted).
  - Admin untouched (supervisory pages only, no per-tenant financial documents).
- Tests (15, rationale headers; 2 membership cases red pre-fix): 12-case decision matrix (unauthenticated/wrong-role/allowed × both apps, unknown role, public paths, sibling-prefix non-matches) + 3 route-membership pins. No DB, no mounts.
- Verification: `db:generate` no drift → `check-types` 6/6 → Biome clean → `db:migrate:test` → FULL suite 86 files / 471 pass + 1 H01 timeout + 1 fast B10 race failure under build-overlapped load (both green in isolation 13/13; H08 touches no API code) → local `bun run build` 5/5 (also proves the `@rently/auth/route-access` subpath resolves under Next); zero residue; `next-env.d.ts` churn restored.
- Terra pointers: callback encoding moved from URLSearchParams to encodeURIComponent (equivalent for real URLs); `ownerHomeUrl`/`tenantHomeUrl` passed but unreachable on their own app (owner/tenant always allowed); prefetch bypass kept proxy-side and untested.
- Next allowed slice: Phase I reconciliation (I01 docs, I02 audit, I03 smoke) — needs owner direction on batching/review before starting.

## I02.1 Refund recovery ledger (finding #1) (2026-09-07, Agent, branch fix/refund-reversal-ledger, tag pre-refund-reversal-ledger)

- Base: clean `integ/phase-a-baseline@1bdaa252` with pending local changes.
- Gap: cash-refund credits lacked a compensating cash inflow in the ledger when reversed, breaking financial symmetry.
- Changed:
  - `routers/rent/credit.ts`: Fixed `reverseCredit` paths. Neon/batch flow uses `db.batch` to guarantee atomic recovery insert and credit state update. Transaction flow correctly runs `ensureRefundRecovery` before `markCreditReversed`.
  - `routers/rent/payment.ts`: Corrected the refund guard placement, forbidding voids on REFUND payments while explicitly allowing them on standard actions, relying purely on the reversing of the source credit.
- Tests (1 new in `credit-refund-gate.test.ts`): Reversal of cash refund creates the expected one positive payment reversal linked to the refund payment.
- Verification: `db:generate` no drift, `check-types --force` 6/6, focused
  Biome, `db:migrate:test`, and H04 recovery tests 6/6.
- Next allowed slice: Finding #2 of the reconciliation phase.

## I02.2 Rent prepayment cap (finding #2) (2026-09-08, branch fix/rent-prepayment-cap, tag pre-rent-prepayment-cap)

- Scope: R6 permits only the next future period. Once that charge exists, its
  remaining balance is already part of period outstanding and no additional
  advance headroom remains.
- Changed: Node and Neon settlement bounds now add one month's headroom only
  when the next IST period has no charge. This prevents an unallocated second
  future-period payment after the first was settled.
- Tests: Node and Neon-path integration regression rejects the second advance
  and retains exactly one payment plus current and next-period charges.
- Verification: `check-types --force` 6/6, focused Biome, `db:migrate:test`,
  and atomic individual settlement tests 8/8.
- Next allowed slice: Finding #3, IST projection in
  `ensureNextFuturePeriodChargeSql`.
