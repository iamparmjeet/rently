# KeyHQ — TODO

> Single source of truth for build progress.
> Update this file as items are completed or priorities shift.
> Tiers: **P0** = must ship before public launch · **P1** = core product gaps · **P2** = growth features · **P3** = post-launch backlog
> Last audited: 2026-08-26 (fix/beta-bugfix-audit-2026-08-26 - 13 pushes S1-S10 + Option-A provisional + payment/tenant/lcp fixes, check-types 6/6, R2 P0 and smoke remain)
> Cost policy: prefer services with a suitable free tier. Move to a paid tier only when measured usage or a required capability exceeds its documented free limits.

---

## V1 Release Decision — 2026-08-14

**Decision: do not release KeyHQ v1 yet.** The codebase is a strong beta candidate, but the production release gate is not closed.

- [x] Current automated verification: `bun run test` — 33 files / 145 tests passed; Vitest loaded `apps/server/.env.test` and enforced the `rently_test` database.
- [x] Current automated verification: `bun run check-types`, `bunx biome check .`, and `bun run build` passed for server, web, dashboard, tenant, and admin.
- [x] **P0 — fix production deployment branch mismatch.** CI runs on pushes to `main`, but the deploy job is gated on `refs/heads/master`; as written, it can never deploy from its trigger branch.
- [x] **P0 — add and verify the admin origin in production `CORS_ORIGINS`.** `apps/admin` is shipped, but `apps/server/wrangler.json` omits `https://admin-keyhq.parmjeetmishra.com`.
- [ ] **P0 — complete the private R2 operational checks** listed in Milestone 2 below: exact CORS policy, unauthenticated denial, presigned PUT/GET expiry, allowed production origins, and rejected unrelated origins.
- [ ] **P0 — deploy the beta configuration with `AADHAAR_UPLOADS_ENABLED=false` and run a production smoke test** for signup/verification, owner and tenant onboarding, payments/receipts, password reset, admin access, and non-Aadhaar document flow.

**Release sequence:** close the P0 items above → deploy as `0.1.0-beta.3` → operate with real beta users and support monitoring → decide v1 only after the production smoke test and an uneventful beta observation window. P1–P3 feature ideas are not v1 blockers.

---

## Active Branch — fix/beta-bugfix-audit-2026-08-26 (2026-08-26, 13 pushes, no emoji after 2026-08-26 20:00 per owner)

> Ship-loop 10 slices + Option-A provisional + follow-ups. Each push `check-types 6/6` + `biome`. R2 `TODO.md:127-128` excluded per owner — separate infra ticket. `AADHAAR_UPLOADS_ENABLED=false` remains beta default `wrangler.json:23` + `env/server.ts:44`, `tenant-document.ts:89` gates per-type.

**Done on branch (pushed to origin):**
- [x] S1 `c45a3ec` XSS `email/src/index.ts:385` `escapeHtml` + `removeUtility` GST guard `utility.ts:392` + `owner-profile.ts:45` validator
- [x] S2 `608eee4` `credit.helpers.ts:8` derived `amountDue = total + credits - payments` + `isPaidDerived`
- [x] S3 `555f938` `payment.ts:100` `createPayment` `amount===due` + `voidPayment` preserve `utilityId` + duplicate guard, `validators/payment.ts:23` `amount positive`
- [x] S4 `ce5f26d` `schema.ts:199` `amount !=0` + `0017` migration + `credit.ts:104` `+abs` reversal with `reversesCreditId`
- [x] S5 `38d27ac` `lease.ts:255` active editable + `FOR UPDATE` `credit.ts:71` + `tenant-portal.ts:346` tx for readings (C-06/C-07)
- [x] S6 `93c0c84` `isNull(deletedAt)` `lease.ts:332/378` `utility.ts:336` `payment.ts:275` + `scheduled-reminders.ts:57` credit-aware + `FAILED` retry + `rent-cycle.ts:12` `effectiveRent`
- [x] S7 `b5bce9e` `beta-smoke-test.md:18` Aadhaar `AADHAAR_UPLOAD_DISABLED` negative + PAN viewer, env default `false`
- [x] S8 `1e8b6ec` `page-loader.tsx:7` sibling + `7afb1ed` `dashboard-sidebar.tsx:91` `render={<Link>}` + `use-mobile.ts:5` `useSyncExternalStore`
- [x] S9 `8468fef` `reading-tab.tsx:42` `parseFloat`/`hasRate` + `bill-tab.tsx:6` sort + `receipts` `fonts.ready` + `use-notifications.ts:7` `5min` + `d27d771` `use-private-document-url-cache.ts:14` `revoke` + `docs-tab.tsx:90` controlled + `bottom-nav.tsx:34` `safe-area` + `credit-notes/utilities` print
- [x] S10 `2560354` `.github/workflows/ci.yml` github-centric (no `wrangler deploy`)
- [x] Option-A `7d875d7` provisional `user/profile` `invite-service.ts:130` for `owner_prepared` so owner can upload/docs/lease/email/whatsapp while tenant `pending` (backfilled `01a03a6a` Parm Tenant), `tenant.ts:176` pending `invite` fallback + `documents-tab.tsx:199` pending banner
- [x] Follow-ups `e552e55` `CreatePaymentSchema` extendable, `fdd5dee` readable `Please select a lease` + helper, `91a933c` LCP `priority` `dashboard-header.tsx:84`, `dfa6a30` `getTenantById` pending fallback, `210b903` `listTenantDocuments` pending 200 + `documents-tab` pending UI, `01a03...` backfilled

**In-progress / Next on branch:**
- [ ] Ship `C+A` hybrid `blur` optimistic + `XHR` `putWithProgress` `>2MB` `useTenantDocuments` + `useTenantDocumentAction` already has `putWithProgress` `use-tenant-documents.ts:22`, UI `uploadProgress` state added `docs-tab.tsx:174` but `blur` card render + owner `documents-tab.tsx:136` `PUT` progress not yet pushed — you are not seeing hybrid because still local
- [ ] Owner `Delete` for pending docs `DELETE /rent/tenant-document/delete` `where ownerId + status in (upload_pending, pending_review, awaiting_tenant_consent)` + `R2 deleteObject` + soft `deletedAt` + `Button Delete` `documents-tab:246`
- [ ] Final `check-types` + `bun run test` `rently_test` + `bun run build` 5/5 + manual `beta-smoke-test.md:18` `AADHAAR` blocked + `PAN` viewer after server restart (`AADHAAR_UPLOADS_ENABLED=true` in both `.env` and `wrangler.json` vars then restart)

**P0 still open (not in this branch per owner):**
- [ ] Private R2 operational checks `cors.json` `r2 bucket cors list`, unauth denial, presigned expiry — separate infra ticket
- [ ] Beta smoke `AADHAAR_UPLOADS_ENABLED=false` config + full `beta-smoke-test.md` 1-19

---

## Recently Completed

- [x] Database schema + constants (`@rently/db`)
- [x] Zod validators — all domains (`@rently/validators`)
- [x] oRPC API — property, unit, lease, tenant, invite, payment, utility
- [x] Auth configuration (Better Auth)
- [x] Hono server + oRPC + OpenAPI wiring (`apps/server`)
- [x] Owner dashboard — Properties, Units, Tenants, Leases, Utilities, Payments
- [x] Owner dashboard — Settings (profile, security, currency, notifications UI shell, billing tab)
- [x] Owner dashboard — Revenue dashboard (12-month chart + recent transactions)
- [x] Tenant portal — all 5 tabs (overview, bills, payments, readings, docs)
- [x] Invite-based tenant onboarding flow (email → set-password → portal)
- [x] Role-based cross-app routing (owner → dashboard, tenant → tenant portal)
- [x] Rate limiting — tenant meter submissions (monthly duplicate guard + burst protection via oRPC middleware)
- [x] **Password reset flow (owners)** — `/forgot-password` → `requestPasswordReset` → role-branched `sendResetPassword` → `sendPasswordResetEmail`. Verified end-to-end.
- [x] **Beta code redemption** — `redeemBetaCode` procedure (transactional, atomic increment) wired in BillingTab and `/subscriptions`. Codes generated via `db:beta-code` seed script (admin panel is the P3 replacement).
- [x] **In-app notifications** — `notifications` table + router (list with lazy lease-expiry creation, unread count, mark read/all) + header bell with polling. Cron-free by design.
- [x] **R2 owner avatar upload** — presigned URL flow with key-scoping guard, `useUploadAvatar`/`useDeleteAvatar`, wired in ProfileTab.
- [x] **Mobile sidebar (Sheet variant)** — shared `Sidebar` renders a `Sheet` on mobile via `useIsMobile()`; `SidebarTrigger` in the header opens it.
- [x] **Milestone 0 — Product Truth and Immediate Defects** — public KeyHQ branding, truthful pricing/copy, legal support contact, corrected local/production URL documentation, invite URLs built from `WEB_APP_URL`, invite delivery feedback and resend action, and stale TODO cleanup.
- [x] **M0 validation** — Vitest invite suite covers cross-owner resend denial, valid resend, expiry, and preserved invites after email delivery failure; typecheck and production build pass.
- [x] **PDF rent receipts + manual payment audit** — owner and tenant receipt flows, deterministic receipt numbers, Indian currency words, printable routes, payment controls, authorization coverage, and integration validation are complete.
- [x] **CSV payment exports** — owner-wide inclusive Indian financial-year/custom-range exports and all-time tenant payment history across active and historic leases, with owner-scoped authorization, signed reversal rows, formula-safe UTF-8 CSV generation, and a 10,000-row cap.
- [x] **Private document viewer lifecycle** — separate View and Download actions; PDF/image previews open in an in-app dialog; preview bytes are cached in browser memory for the current tab only.
- [x] **Neon HTTP document writes** — document lifecycle mutations use Neon-compatible atomic batches; the Docker-only test fallback remains isolated to `rently_test`.
- [x] **Admin Dashboard V1** — separate private app, strict admin authorization, truthful revenue and managed-volume reporting, redacted user support lookup, audited manual subscription payments, beta-code management, and audit history.
- [x] **Admin production hygiene** — removed production-marked browser debug logging while retaining structured server failure reporting.

---

## Completed Milestone — M1: Hard Email Verification and Unified Onboarding

### M1a — Hard email verification (owner) + soft for owner-created tenants (restored 2026-08-26)

- [x] Configure Better Auth `requireEmailVerification:true` to send verification email on owner signup and on unverified password sign-in.
- [x] Require verified email for **owner** password login; existing unverified owner accounts must verify at next login.
- [x] **Restored: owner-created tenants are auto-verified** — `acceptInvite` sets `user.emailVerified=true` for both `owner_prepared` and `tenant_completed` (invite email is trust signal). Tenant gets invite message but does not need hard verification at that instant; rest of features (portal, bills, readings, docs) enabled immediately. `invite.ts:423,433` + `packages/auth/src/index.ts:48` hard gate applies to owners, tenant auto-verified bypasses it.
- [x] Add a dedicated verification-required screen with resend feedback and a safe return path (owner flow).
- [x] Automatically establish the session after a successful verification.
- [x] Defer beta-code redemption until a verified owner session exists; beta-code signups land on `/subscriptions` after verification, with no code persisted in URLs or browser storage.
- [x] Test owner signup delivery, unverified-login blocking, successful verification, resend state, and redirect behavior + tenant auto-verified acceptance (invite suite `invite.test.ts:495,503` expects `emailVerified:true` after `acceptInvite`).

### M1b — Unified tenant onboarding

- [x] Add `TenantOnboardingMode`: `owner_prepared` and `tenant_completed`.
- [x] Extend invitations with `onboardingMode`, `deliveryStatus`, `lastSentAt`, and a safe delivery error code.
- [x] Replace direct tenant account creation: both onboarding modes create an invitation first; Better Auth user creation occurs only during acceptance.
- [x] Owner-prepared acceptance: tenant reviews prefilled details, consents, sets password, and atomically creates account/profile/accepted invite.
- [x] Tenant-completed acceptance: owner provides name/email; tenant completes contact/address/emergency details, consents, and sets password.
- [x] Mark accepted system-delivered invitations as email verified.
- [x] Add owner-prepared `createTenant`, tenant-completed `createInvite`, `resendInvite`, and extended `acceptInvite` procedures with atomicity and cross-owner test coverage.

### M1 exit criteria

- [x] A new owner verifies their email and signs in without manual intervention.
- [x] One tenant completes each onboarding mode without direct database intervention.
- [x] Failed delivery is visible, resend works, expired invites are rejected, and no orphaned user is created after a failed acceptance.

> M1b database integration is verified against a freshly migrated `rently_test`; the invite suite passes. Implementation, source coverage, Biome, and workspace type checking are complete.

---

## 🚀 Beta Release Gate — must complete before beta opens

> Gate test: "Can a stranger sign up, use the product, pay me, and recover their account without manual intervention?"

- [x] **Hard email verification and unified onboarding** — complete Milestone 1 above.
- [x] **Mobile QA pass** — dashboard and tenant portal verified on mobile. `SidebarTrigger` is the mobile menu control.
- [x] **`referrers` table decision** — leave it dormant during beta; no procedures or UI yet.

### Fast-follow (beta week 1–2, not gating)

- [x] PDF rent receipts — implemented and validated for owner and tenant flows.
- [x] Subscription status badge in sidebar

---

## Completed Milestone Detail

### Notification Preferences + Email Triggers _(Milestone 6)_

> In-app notifications are DONE. This section is only the preference-driven email layer.

- [x] Create one owner-scoped `notificationPreferences` row with `paymentReceived`, `utilityBillGenerated`, `leaseExpiryAlert`, `rentDueReminder`, `overdueAlert`, and `updatedAt`.
- [x] Replace `localStorage` with owner-scoped query and mutation hooks.
- [x] Wire `paymentReceived` toggle → send email on `createPayment` success
- [x] Wire `utilityBillGenerated` toggle → send email when a utility bill is approved/generated.
- [x] Convert `buildReceiptMessage()` to the shared KeyHQ HTML email wrapper.
- [x] Scheduled preference-driven email reminders follow in Milestone 7.

### Private Tenant Documents _(Milestone 2 — Tenant Trust Workflows)_

- [x] Create `tenantDocuments`; store a private R2 key, document type/version, masked identifier, consent, status, submitter/reviewer metadata, notes, and audit timestamps.
- [x] Never add public document URL columns to `tenantProfiles` or return permanent public URLs. Provide short-lived, owner/tenant-authorized signed download URLs only.
- [x] Store only Aadhaar last four digits in PostgreSQL; require masked Aadhaar uploads and label reviews as “owner reviewed,” never UIDAI verified.
- [x] Keep Aadhaar uploads behind a production compliance feature flag.
- [x] Implement initial submission, consent, owner review, private download, expiry, purge, and authorization interfaces.
- [x] Add tenant upload/consent and owner upload/review UI in the portal/dashboard Docs experiences.
- [x] Add the private-bucket environment contract and migration that preserves legacy update-request rows.
- [x] Add separate inline preview and attachment download behavior for all supported document types.
- [x] Add tab-lifetime in-memory preview caching without localStorage, IndexedDB, permanent URLs, or stored signed URLs.
- [x] Apply the document migration to the current Neon development branch and verify the document upload flow.
- [ ] Apply and verify the exact CORS policy on `keyhq-private-documents` with `r2 bucket cors list`.
- [ ] Complete real R2 smoke tests: unauthenticated denial, signed PUT/GET expiry, allowed dashboard/tenant origins, and rejected unrelated origins.
- [ ] Commit the feature branch, push it, and open the PR into `beta2` after review of the combined multi-lease + M2 diff.
- [ ] Deploy beta with `AADHAAR_UPLOADS_ENABLED=false`; verify non-Aadhaar flows before production rollout.

### Document Update Lifecycle _(Milestone 2 — Tenant Trust Workflows)_

- [x] Initial submission: `upload_pending → pending_review → owner_reviewed | rejected`.
- [x] Later changes: `pending request → approved → submitted → completed`, with terminal `rejected | expired` states.
- [x] An approved update request opens a 48-hour submission window; the prior owner-reviewed document remains active until final approval.
- [x] Implement replacement requests, owner decisions, replacement submission, transactional supersession, and expiry handling.

---

## P1 — Core Product Gaps

### Completed — Admin Dashboard V1

- [x] Separate `apps/admin` application using shared KeyHQ UI and internal `rently` packages.
- [x] `adminProcedure` and strict cross-app route protection; owner, tenant, unknown-role, and unauthenticated sessions are rejected or redirected.
- [x] Overview with registration, verification, subscription, plan-distribution, paid-invoice platform revenue, managed rent volume, and recent-activity data.
- [x] Paginated user and subscription lookup with support-safe redacted details and filters.
- [x] Atomic manual payment recording with duplicate-reference protection, subscription activation/extension, cumulative totals, paid invoice creation, mandatory reason, and audit entry.
- [x] Paginated beta-code creation and explicit expiry with mandatory reasons, auditing, usage visibility, and concurrency guards.
- [x] Admin audit log with safe structured metadata. Private document values, authentication secrets, sessions, and signed storage URLs remain excluded.
- [x] Integration coverage runs only through `apps/server/.env.test` against `rently_test`; admin build, server build, Biome, and workspace type checking pass.

> Implementation and learning notes: `docs/admin-v1.md`.

### Rent Cycle + Cloudflare Cron _(Milestone 7)_

- [x] Create `queryRentCycleRows`, `computeRentCycleItem`, period-key generation, and configurable owner lead/grace days (defaults: 3 days before due and 2 days after due).
- [x] Create a scheduled-email delivery deduplication table with a unique owner/lease/type/period/threshold key. Cloudflare Cron delivery is at-least-once, so this database constraint—not an in-memory lock—prevents duplicate emails.
- [x] Export both `fetch` and `scheduled` handlers from the Worker entry point.
- [x] Configure the Worker with `"triggers": { "crons": ["30 2 * * *"] }`; Cloudflare cron uses UTC, so this runs at 08:00 IST.
- [x] Start with this single Cloudflare Free-plan trigger. Reassess only if the job cannot stay within its 10 ms CPU / 50 external-subrequest limits, or if more than five account-level Cron Triggers are needed.
- [x] In `scheduled()`, await the reminder job; reserve `ctx.waitUntil()` for separately tracked concurrent work.
- [x] Send lease-expiry reminders at 30, 7, and 1 days; rent-due reminders on each owner’s configured lead day; and period-aware overdue reminders after the owner grace period.
- [x] Respect notification preferences and use the deduplication record before every email attempt.
- [x] Keep total transactional email volume within the active email provider’s free quota; currently, Resend Free permits 3,000 emails/month and 100/day. Reassess paid email only when observed beta volume requires it.
- [x] Test repeated scheduled executions, Asia/Kolkata date boundaries, and notification-preference enforcement. During local development, trigger the handler through Wrangler’s `/__scheduled` endpoint.

### PDF Rent Receipts

- [x] `getPaymentReceiptData` oRPC procedure — enriched JOIN (payment + owner profile + property + unit + tenant)
- [x] `generateReceiptNumber(paymentId)` utility in `@rently/db/utils/receipt.ts` (deterministic from UUIDv7)
- [x] `rupeesToWords(paise)` utility in `@rently/ui/lib/currency.ts` (Indian numbering — lakh/crore)
- [x] `/receipts/[paymentId]` route in `apps/dashboard` — print-optimised HTML + `window.print()`
- [x] `getMyPaymentReceiptData` oRPC procedure (tenant-scoped, `protectedProcedure`)
- [x] `/receipts/[paymentId]` route in `apps/tenant`
- [x] "Download" button in `PaymentDetailDialog` → `window.open('/receipts/[id]?print=true')`
- [x] "Download" button in tenant portal payment history

### Late Payment / Overdue Tracking

- [x] Define "overdue" — after the current month's due date with rent still outstanding; partial payments remain overdue for the balance
- [x] `getOverdueLeases` query — owner-scoped leases past due date with no full rent payment this cycle
- [x] Overdue badge on tenant card in dashboard
- [x] Overdue summary card on revenue dashboard
- [x] `overdueAlert` notification trigger (period-deduplicated in-app notifications)

### Data Export

- [x] CSV export for payment history per tenant (owner use — tax / ITR filing)
- [x] CSV export for all payments in a date range (all tenants, all properties)
- [ ] Consider: Excel (.xlsx) variant via `SheetJS` if demand warrants it

### GST Billing + GST-Safe Discount / Write-Off _(NEW — Planned — must ship before v1, beta default OFF)_

> Research: `docs/research/utility-discounts-in-pms.md:8` — no PMS puts `discount` inside `(units × rate) + fixedCharge`. Always keep `totalAmount` fixed, add a separate negative credit. GST-safe = keep original invoice + add Credit Note (ApnaComplex:138). Current gap: `packages/db/src/schema/schema.ts:133` `utilities.totalAmount` + `isPaid:135` with `packages/api/src/routers/rent/utility.ts:465` exact-amount check and `updateUtility:206` in-place edit is not GST-safe after issue.
> Disclaimer: GST rates are owner-configured; KeyHQ shows what you set. Confirm your HSN/rate with your CA — residential renting is typically 0% exempt, commercial/shop is 18%. Electricity/Water supply by owner is typically 0% with no GST. App shows separate GST line only when `gstEnabled=true`.

**Agreed decisions (2026-08-20 — reconfirmed, one clarification):**
- GST: configurable via Settings (not hardcoded). Defaults: `gstEnabled=false`, `gstRateRent=0` (exempt), `gstRateMaintenance=0`, electricity/water locked 0% — not selectable. Allowed rents: `0/5/12/18` only. Toggle ON only if `ownerProfiles.gstNumber` present (`apps/dashboard/src/components/features/settings/profile-tab.tsx:287`). Answer to open question: **default rent GST = 0% exempt** (suggest 18% option in UI helper text, don't default to 18%).
- Discount scope: both Rent + Utilities (general credit, not utility-only). `utilityId nullable` — `null = rent/general`, `not null = that utility bill`.
- After full payment: allow both **Refund** (cash back) and **Adjust in next bill/rent cycle** (carry-forward credit).
- Credit Note No: auto `KQ-CN-xxx` per owner like `apps/dashboard/src/lib/utility-bill.ts:16` `KQ-UTL-xxx` — last 12 of uuid uppercased, unique per owner.
- Wrong credit: never delete — create reverse entry (`+abs(amount)`), like `packages/api/src/routers/rent/payment.ts:274` `voidPayment` reversal pattern. Keep audit trail.
- Reason required: min 10 chars, amount `abs(amount) <= amountDue` (or `<= totalAmount` for pre-payment utility discount). Validate in API, not just DB check.

**Audit fixes to original draft (2026-08-20 review):**
- Never add `utilities.discount` column (anti-pattern: `subscription.ts:37` style). Keep `totalAmount` immutable — credits are separate rows.
- `isPaid` boolean stays in DB for migration compat but app must use derived `amountDue <= 0`. Don't drop column in beta — dual-read then deprecate.
- Rent has no invoice row — `amountDue` for `utilityId=null` (rent) must be defined against a computed rent due (lease.rent for current cycle), not `totalAmount`. See Q2 below.

- [x] **DB — Tax settings (phase 1, no breaking change):** extend `ownerProfiles` (`packages/db/src/schema/schema.ts:392`) with `gst_enabled boolean default false`, `gst_rate_rent integer default 0 check in (0,5,12,18)`, `gst_rate_maintenance integer default 0 check in (0,5,12,18)` (electricity/water categories locked 0% in app logic, not DB). Beta default OFF. Add migration `0016_gst_and_bill_credits.sql`. Keep existing `gstNumber:399` as gate.
- [x] **DB — `bill_credits` table (general, not utility-only):** `id uuid pk`, `lease_id fk -> leases.id restrict`, `utility_id fk -> utilities.id restrict nullable (null=rent/general)`, `owner_id fk -> user.id` (for KQ-CN uniqueness scope + fast filter), `type enum('discount'|'write_off'|'credit_note')`, `amount integer not null check (amount < 0)` (paise, negative only), `reason text not null check (char_length(reason) >=10)`, `credit_note_no text unique not null` (`KQ-CN-xxx`), `applied_as enum('adjust'|'refund') default 'adjust'` (covers decision 3 for post-paid case), `reverses_credit_id uuid fk nullable` + `reversed_at timestamp nullable`, `created_by uuid fk -> user.id`, `created_at timestamp defaultNow`, `updated_at`. Indexes: `lease_id, utility_id`, `owner_id, credit_note_no` unique, `created_at`. Check `abs(amount) <= outstanding` enforced in API tx (DB check can't see sum without trigger — enforce in `createCredit` tx).
- [x] **DB — Derived due (app-level view, not DB view yet):** helper `getUtilityAmountDue(utilityId)` = `totalAmount + sum(credits.amount) + sum(credit reversals where amount>0) - sum(payments.amount where type='utility')` (payments already exclude reversals). `isPaidDerived = amountDue <= 0`. For rent (`utilityId=null`): `rentDue = lease.rent + sum(credits where utilityId is null) - sum(payments where type='rent' this cycle)` — needs period key; start with simple `lease.rent` outstanding for beta, then add period-aware rent ledger in follow-up. Replace direct `isPaid` boolean checks in `utility.ts:460`, `payment.ts:144`, `tenant-portal.ts` with helper. Keep boolean column in sync via tx for legacy reads until frontend cutover, then read derived.
- [x] **Backend — Settings API:** extend `packages/api/src/routers/rent/owner-profile.ts:32` `upsertOwnerProfile` (or new `updateGstSettings` procedure) — validate `gstNumber` present before `gstEnabled=true`, validate rates `0/5/12/18`, reject enabling GST if GSTIN format invalid (15 chars, basic regex). Return profile with new fields via `OwnerProfileSelectSchema`.
- [x] **Backend — Credit API (new router `packages/api/src/routers/rent/credit.ts`):** `createCredit` (auth `isLeaseOwner`, validate `reason>=10`, `amount<0`, `abs(amount) <= amountDue`, generate `KQ-CN-xxx` via `generatedId()`, insert in tx with row-level lock on utility/lease), `reverseCredit` (insert `+abs(amount)` row with `reverses_credit_id`, never delete, set `reversed_at`), `listCredits` (owner-scoped by leaseId/utilityId). Reuse `payment.ts:274` reversal shape. Add `CREDIT_TYPE_VALUES` + `APPLIED_AS_VALUES` to `packages/db/src/constants/payment-constants.ts`.
- [x] **Backend — Payment/utility logic:** update `recordUtilityPayment:433` to accept `amount === amountDue` (not `=== totalAmount:465`), allow partial? No — keep full-settlement for beta (partial later). Update `createPayment:100` utility branch to set `isPaid` via derived check, not unconditional `true`. Allow `createCredit` after paid — if `applied_as='refund'` → create negative `payments` reversal? Actually refund = create `payments` row with `amount = -abs(credit)` + type `reversal` linked; if `adjust` → keep credit as carry-forward, next cycle's `amountDue` auto includes it. Block `updateUtility:206` rewrite of `totalAmount` when `gstEnabled=true` or when `payments`/`credits` exist — force credit path; allow edit only when `amountDue === totalAmount` and no payments.
- [x] **Frontend — Settings UI:** new `Tax & GST` tab in `apps/dashboard/src/components/features/settings/settings-client.tsx:22` (add to `TABS:22` + `TabId` union). Toggle `Enable GST` (disabled helper: "Add GSTIN in Profile first"), two selects: Rent rate (0/5/12/18) + Maintenance rate (0/5/12/18) with electricity/water locked 0% note. Show `gstNumber` read-only echo from `profile-tab.tsx:287`. Add CA disclaimer. Wire to `useUpsertOwnerProfile` / new `useGstSettings`.
- [x] **Frontend — Bill UI:** extend `apps/dashboard/src/lib/utility-bill.ts:20` `getUtilityBillChargeLines` to append negative `bill_credits` lines (label `Discount — <reason>` / `Credit Note KQ-CN-xxx`), update `apps/dashboard/src/lib/utility-bill-payment-state.ts:5` to consume `amountDue` not `isPaid`, add Discount/Write-off dialog on utility + rent bill cards (fields: amount paise, reason >=10, type, Refund vs Adjust radio). Show `amountDue` badge + original `totalAmount` strikethrough when credits exist.
- [x] **Frontend — Receipt/PDF:** Credit Note PDF route `apps/dashboard/src/app/(dashboard)/credit-notes/[id]/page.tsx` + shared print template — shows `KQ-CN-xxx`, original `KQ-UTL-xxx` (`utility-bill.ts:16`), GSTIN if `gstEnabled`, HSN, rate snapshot, reason, `generatedId` date. Reuse `packages/db/src/utils/receipt.ts:generateReceiptNumber` pattern for deterministic fallback.

## P2 — Growth Features

### WhatsApp Business API

- [ ] Research providers for Indian market — Interakt / Wati / AiSensy (all support BSP API)
- [ ] Replace `wa.me` deep links with actual API calls for payment receipts
- [ ] WhatsApp notification channel alongside email in notification preferences
- [ ] Template message approval (required by WhatsApp BSP for transactional messages)

### Razorpay Integration

- [ ] Deferred until 20+ paying users — manual UPI covers beta
- [ ] When ready: `razorpay` npm package, subscription webhook handler, `invoices` table population

### Maintenance Request System

- [ ] `UTILITY_TYPES.MAINTENANCE` exists but has no tenant-facing workflow
- [ ] Tenant raises a maintenance request from portal (description + optional photo via R2)
- [ ] Owner sees open requests in dashboard with status (open / in progress / resolved)
- [ ] New DB table: `maintenanceRequests` (or extend `documentUpdateRequests` pattern)

### Bulk Operations

- [ ] Bulk rent reminder — select multiple tenants → send WhatsApp / email in one action
- [ ] Bulk mark paid — select multiple leases → record rent payment for all
- [ ] Bulk utility generation — generate readings for all units of a property in one batch

---

## P3 — Post-Launch Backlog

- [x] **Two-factor authentication — DEFERRED** — `feat/2FA` evaluated 2026-08-25 on `feat/account-linking-security` (branch `feat/account-linking-security @ 7d8a1b9`). Deferred for Indian owner segment (low tech-savvy, high friction); Google's own 2FA + email verification mitigates leaked-password risk. Revisit only after 20+ paying owners request it. See `docs/Feature-2FA-deferred.md` + `Deferred / Decided Against` row.
- [x] **Account linking polish + Security sessions (DONE `feat/account-linking-security` 6489ee1 → `main`)** — Google `linkSocial`/`unlinkAccount` + `setPassword` for OAuth-only users + `listSessions`/`revokeSession` beautiful device cards in `SecurityTab` (`security-tab.tsx:38`), hydration guard (`mounted`). No DB migration. `check-types` 6/6, `build` 5/5.
- [ ] **Owner-domain mutation auditing** — separately track owner changes for tenant disputes; do not mix this broader concern with the completed admin-operation audit trail.
- [ ] **Tenant communication history** — store sent emails in a `tenantMessages` table so owners can see past correspondence
- [ ] **Multi-property analytics** — per-property revenue breakdown, occupancy rate over time, vacancy duration tracking
- [ ] **`@react-pdf/renderer` upgrade** — replace `window.print()` receipt approach with a proper PDF blob for email attachments via Resend
- [ ] **Vacancy report** — units vacant for > N days, time-to-fill tracking

---

## Known Technical Debt

- [x] **Ledger/lifecycle integrity (2026-09-03 audit)** — completed on `fix/ledger-integrity-2026-09-03` in S1-S7 (`443cbca` through `134ba50`); migration `0022` adds settlement idempotency keys. Period-aware rent remains separately deferred below.
- [ ] **Manual: multi-unit tenant meter submission** — give an existing local tenant two active leases, submit a reading for each selected unit in the tenant portal, and confirm each creates an owner-visible bill for that unit with unit-specific prior reading and estimate. Do not use a newly invited tenant.
- [ ] **Period-aware rent due** — deferred to `feat/period-aware-rent`. `getAmountDueForRent` currently sums lifetime `rent + credits − paid`, so month-two rent reads as already-paid after month-one settlement. Needs a period-key migration + migration of all readers (payments/overdue/reminders/portal/export). See `Decisions.md 2026-09-03`.
- [x] `notifications-tab.tsx` — `// TODO: migrate from localStorage` comment. Preferences now use owner-scoped database storage.
- [x] `buildReceiptMessage()` in `payment.ts` — replaced with shared KeyHQ HTML templates in `@rently/email`
- [x] Production-marked debug logging removed; actionable server failures retain structured contextual logging.
- [x] Notification preference fields are database columns, not `turbo.json` environment variables.
- [x] **Fresh Drizzle migration bootstrap** — applied and verified all migrations, including `0008_productive_toad`, against the empty `rently_test` database.
- [x] **M1b test-database migration diagnosis** — repaired the explicit text-to-timestamp casts in `0002_easy_iceman`; `0007_unique_the_hand` now applies as part of the clean migration path and the invite integration suite runs locally.

---

## Deferred / Decided Against

| Item                                       | Decision                                                                                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Redis / Upstash for rate limiting          | DB-based count query is sufficient for beta scale. Revisit at 1000+ active tenants or multi-instance deployment                                 |
| `jsPDF` / `pdfmake` for receipts           | Browser `window.print()` produces better output with zero bundle cost. Server-side PDF generation (`pdf-lib`) only needed for email attachments |
| Separate `/new` and `/edit` routes         | All CRUD uses inline `FormDialog` pattern — keep consistent                                                                                     |
| Cron for in-app lease-expiry notifications | Lazy creation inside `listNotifications` — cron only needed for the _email_ channel (P1)                                                        |
| Referral system                            | Dormant during beta. Revisit only when referrals become an intentional acquisition channel.                                                   |
| TOTP 2FA / Passkey (`SecurityTab` placeholder `security-tab.tsx:168`) | Deferred 2026-08-25 — high friction for Indian owners; password + Google link + email verification covers beta. Revisit after 20+ paying owners or admin high-value accounts request it. Passkey (`@better-auth/passkey`) evaluated as alternative — also deferred (device/recovery friction). |
| Period-aware rent due model | Deferred 2026-09-03 — design change needing a period-key migration + reader migration; tracked as its own `feat/period-aware-rent` branch. |

---

## Roadmap After Admin V1

- [x] Owner CSV exports — tenant history and selected date ranges are complete. Defer `.xlsx` until beta users show CSV is insufficient.
- [ ] Demand-led product work — maintenance requests, bulk reminders/payment recording/utility generation, WhatsApp Business API, communication history, multi-property analytics, and vacancy reporting remain uncommitted until beta feedback establishes priority.
- [ ] Payment automation threshold — manual UPI plus Admin V1 remains the beta workflow. Revisit Razorpay at 20 or more paying users, or earlier only if reconciliation becomes measurably unreliable.
