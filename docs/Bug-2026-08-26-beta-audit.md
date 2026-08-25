# Bug-2026-08-26-beta-audit — Beta Gate Bugfixes (ship-loop, github-centric)

> Branch: `fix/beta-bugfix-audit-2026-08-26` off `main@b2ed822`
> Risk tier: **High-risk** (payments, credits, authz, GST, migrations-adjacent) — full loop: Map+Constrain+Plan+Bug trace+rollback
> Exclusions per owner: **R2 private bucket operational checks** (`TODO.md:127-128` CORS list, unauth denial smoke) are **out of scope** for this branch — separate infra ticket. **Aadhaar uploads** (`AADHAAR_UPLOADS_ENABLED=false` + gated routes) **are in scope** — code paths must be correct behind flag, even if prod smoke stays separate.
> Github-centric: no manual `wrangler r2 bucket cors set` / `wrangler deploy` from local. All validates via CI (`bun run check-types`, `bun run build`, `bun run test` against `rently_test`) and GitHub Actions (future). Local `wrangler dev` allowed for `MANUAL QA` only.

## Found — Audit 2026-08-26 (code + TODO.md diff)

**TODO gate still `[ ]`:** `TODO.md:19` R2 checks (excluded), `TODO.md:20` beta smoke with `AADHAAR_UPLOADS_ENABLED=false` — smoke checklist exists `docs/beta-smoke-test.md:1` but no prod evidence recorded.

**Critical regressions from `feat/utility-discounts 8d32713`:**
- C1 `lease.ts:255` dead `updateLease` — both `active` and `terminated|expired` throw → no update ever succeeds
- C2 `payment.ts:139` `createPayment` utility branch unconditional `isPaid:true`, no `amount===amountDue` vs `utility.ts:509` correct check
- C3 `credit.helpers.ts:8` `getAmountDue*` omits `payments` subtraction → `TODO.md:214` spec violated, over-discount allowed
- C4 `payment.ts:292` `voidPayment` loses `utilityId`, no duplicate-void guard
- C5 `credit.ts:128` `reverseCredit` only sets `reversedAt`, never inserts `+abs(amount)` with `reversesCreditId` per `TODO.md:216`
- C6 race `tenant-portal.ts:372` + `credit.ts:71` no `FOR UPDATE` / unique `(leaseId,period,utilityType)` → parallel inserts over-discount
- H1 GST gate DB lacks `CHECK gst_enabled=>gst_number`, validator merge `owner-profile.ts:20 vs 36` mismatch, `H2 removeUtility:393` bypasses GST lock, `H3` list leaks soft-deleted `properties.deletedAt`, `H4` XSS `email/src/index.ts:385`, `H5` rent cycle ignores `bill_credits`, `H6` scheduled `FAILED` never retries `scheduled-reminders.ts:300`

**Frontend gaps:** `PageLoader` clip `packages/ui/src/shared/page-loader.tsx:7`, `SidebarMenuButton` `<button><a>` `dashboard-sidebar.tsx:91`, `useIsMobile` hydration `packages/ui/src/hooks/use-mobile.ts:6`, `BillTab` picks first not latest `bill-tab.tsx:6`, `ReadingTab` `parseInt` `reading-tab.tsx:42`, dead `bill-tab.tsx:126` Download, 6h notification poll `use-notifications.ts:7`, `history.back()` trap `receipts/[paymentId]/page.tsx:55`, print race `receipts/[paymentId]/page.tsx:27`, `use-private-document-url-cache.ts:14` leak `URL.createObjectURL` never revoked, `docs-tab.tsx:173` `querySelector`.

## Reproduced (pre-fix verification)

- `bun run check-types` 6/6 green, `bun run build` 5/5 green, `bun run test` 91/145 pass (54 ECONNREFUSED no local pg) — same as `docs/Handover.md:19`
- Code-level repro for C2/C3/C5 verifiable without DB: read `credit.helpers.ts:29` no `payments` sum; `credit.ts:103` no insert; `payment.ts:139` no `amountDue` check — confirmed via `read` 2026-08-26
- No DB migration needed yet — all fixes are API/helpers + UI, `bill_credits` schema stays `schema.ts:163` (global `credit_note_no` unique accepted for beta, per-owner unique deferred)

## Plan — Slices (one logical change per ship-loop turn, approval-gated)

All slices start from this file's commit `fix/beta-bugfix-audit-2026-08-26`. Rollback per slice: `git revert <slice-sha>` or `git restore <files>` + re-run `check-types` + relevant `vitest`. No slice touches R2 CORS infra.

| # | Tier | Slice | Files | Why now | Rollback |
|---|------|-------|-------|---------|----------|
| S1 | Small | **XSS + email + GST validator hardening** — `escapeHtml(message)` `email/src/index.ts:385`, fix `removeUtility` GST block, add `CHECK` comment for GST gate | `packages/email/src/index.ts`, `packages/api/src/routers/rent/utility.ts`, `packages/validators/src/owner-profile.ts`, `packages/db/src/schema/schema.ts:441` comment+optional check (no migration this slice) | P0 XSS, one-liner | `git restore packages/email/src/index.ts packages/api/src/routers/rent/utility.ts` |
| S2 | Medium | **Derived due correct** — `getAmountDueForUtility/Rent` subtracts `payments` per `TODO.md:214`, `isPaidDerived = amountDue<=0` | `packages/api/src/routers/helpers/credit.helpers.ts`, add helpers tests | Fixes C3 + H5 prerequisite, unblocks S3 | `git revert` S2 sha |
| S3 | Medium | **Payment paths align** — `createPayment` utility branch `amount===amountDue` + block `type:reversal`, preserve `utilityId` in `voidPayment`, duplicate-void guard | `packages/api/src/routers/rent/payment.ts`, `packages/validators/src/payment.ts` | C2+C4 | revert S3 |
| S4 | Medium | **Reverse credit per spec** — insert `+abs(amount)` row with `reversesCreditId`, set `reversedAt` on original, never delete | `packages/api/src/routers/rent/credit.ts`, `packages/db/src/schema/schema.ts:183` check note (negative-only stays, reversal is separate positive row — needs `CHECK amount<0` relaxed or new table? Keep negative check, reversal row is `+abs` so needs `CHECK amount!=0` — gate in API until migration) | C5 | revert S4 |
| S5 | Medium | **Concurrency + lease fix** — `updateLease` remove dead trap (allow `active→active` field edits, block only `terminated/expired` if that is intent — confirm), `FOR UPDATE` lock in `createCredit` + `submitMyReading`, add `(leaseId, periodKey, utilityType)` dedupe where missing | `packages/api/src/routers/rent/lease.ts:255`, `credit.ts:71`, `tenant-portal.ts:372` | C1+C6+C7 | revert S5 |
| S6 | Small | **Query leaks + scheduled retry** — filter `isNull(properties.deletedAt)` in `listLeases/listUtilities/listPayments/getLeaseById`, retry `FAILED` via `updatedAt+1h` allow re-claim, `paidAmount` excludes `billCredits` | `packages/api/src/routers/rent/{lease,utility,payment}.ts`, `scheduled-reminders.ts:203,300`, `rent-cycle.ts:138` | H3+H6+H5 | revert S6 |
| S7 | Medium | **Aadhaar behind flag — harden** — verify `tenant-document.ts:89,284` gates `AADHAAR` type on `beginTenantDocumentUpload` + `review`, ensure `env/server.ts:44` default false, add API test `AADHAAR_UPLOAD_DISABLED` when flag false, update `beta-smoke-test.md` with Aadhaar-blocked step, no R2 CORS change | `packages/api/src/routers/rent/tenant-document.ts`, `packages/env/src/server.ts`, `docs/beta-smoke-test.md`, tests | Owner asked in-scope, github-centric validation | revert S7 |
| S8 | Small | **Frontend P0 UX** — `PageLoader` sibling layout, `SidebarMenuButton` `render={<Link>}`, `useIsMobile` `useSyncExternalStore`, `BillTab` sort by `currentReadingDate desc`, `ReadingTab` `parseFloat` + null rate guard, hide dead Download btn, `history.back()` → `router.push('/payments')` fallback, `window.print()` wait `document.fonts.ready` | `packages/ui/src/shared/page-loader.tsx:7`, `packages/ui/src/components/sidebar.tsx:68`, `apps/dashboard/.../dashboard-sidebar.tsx:91`, `apps/tenant/src/components/features/tenant/*.tsx`, `apps/dashboard/src/app/receipts/[paymentId]/page.tsx:27` | Medium UX debt | revert S8 |
| S9 | Small | **Frontend polish + memory** — `URL.revokeObjectURL` on `PrivateDocumentViewer` unmount + cache clear on logout, `docs-tab.tsx` controlled inputs, poll `5min` `use-notifications.ts:7`, `BottomNav` `safe-area-inset-bottom`, `reading-tab` estimate memo | `packages/ui/src/hooks/use-private-document-url-cache.ts:14`, `packages/ui/src/components/private-document-viewer.tsx`, `apps/tenant/.../docs-tab.tsx`, `apps/dashboard/src/hooks/notifications/use-notifications.ts` | S8 follow-up | revert S9 |
| S10 | Trivial | **Github-centric CI** — add `.github/workflows/ci.yml` (`bun install`, `check-types`, `biome`, `build`, `test` against `rently_test` not Neon, no `wrangler deploy`, `wrangler r2 bucket cors list` is manual separate infra ticket), document in `Constraints.md` why no `wrangler push` from local | `.github/workflows/ci.yml`, `docs/Constraints.md`, `docs/Handover.md` | Owner constraint: github centric, some `wrangler dev` valid locally | revert S10 |

**Execution order:** S1→S2→S3→S4 (payments/credits cluster), S5→S6 (concurrency/queries), S7 (Aadhaar), S8→S9 (frontend), S10 (CI). Each slice PR-ready individually, `fix/beta-bugfix-audit-2026-08-26` stays linear, merge to `main` only after S1-S7 green.

## Tried / Didn't work — reserved per slice

## Worked — per slice commits

## Verified — checklist per slice

Trivial: `bun run check-types` (expect 6/6)
Small: `check-types` + single `vitest run <file>`
Medium/High: `check-types` + `bunx biome check <files>` + `vitest run` (full, `rently_test`, Neon migration still passes `0002_easy_iceman` cast + `0016_gst`) + `bun run build` 5/5 + manual path `listNotifications` or `createCredit` negative path

Bug trail stays in this file; `Decisions.md` logs why per slice; `Flow.md` touched path only per slice.
