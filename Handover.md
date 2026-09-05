# Handover — 2026-09-05 — model: Muse Spark — branch: integ/phase-a-baseline (batching A03+; see workflow note)

## Workflow note (2026-09-05, owner-directed)
- Batching: slices merge one-branch-per-slice into `integ/phase-a-baseline` (cut from clean `main@8e27688`, rollback tag `pre-integ-phase-a-baseline`), then one rollup PR into `main`. Rollback tags per slice retained. CI gates PRs to both branches (trigger extended in `c0cfe04`; PR-only, no per-commit runs).
- A03 merged as PR #7 (CI green, merged 2026-09-05). Fix-Plan A03 stays `[~]` until Terra review.
- Implementer is now Muse Spark throughout; Terra review is deferred, not waived.
- Terra review debt (must clear before any `[x]` or `main` rollup): A03 (Terra Medium), A04 (Terra High), and every later slice per Fix-Plan §7.
- Muse rules until debt is paid: no business-semantic decisions without stopping to ask; nothing production-touching; slices stay `[~]` at best.

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
