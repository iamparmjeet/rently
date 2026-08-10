# KeyHQ — TODO

> Single source of truth for build progress.
> Update this file as items are completed or priorities shift.
> Tiers: **P0** = must ship before public launch · **P1** = core product gaps · **P2** = growth features · **P3** = post-launch backlog
> Last audited: 2026-08-10 (verified against the private-document milestone branch)
> Cost policy: prefer services with a suitable free tier. Move to a paid tier only when measured usage or a required capability exceeds its documented free limits.

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
- [x] **Private document viewer lifecycle** — separate View and Download actions; PDF/image previews open in an in-app dialog; preview bytes are cached in browser memory for the current tab only.
- [x] **Neon HTTP document writes** — document lifecycle mutations use Neon-compatible atomic batches; the Docker-only test fallback remains isolated to `rently_test`.

---

## Completed Milestone — M1: Hard Email Verification and Unified Onboarding

### M1a — Hard email verification

- [x] Configure Better Auth to send verification email on signup and on unverified password sign-in.
- [x] Require verified email for password login; existing unverified accounts must verify at their next login.
- [x] Add a dedicated verification-required screen with resend feedback and a safe return path.
- [x] Automatically establish the session after a successful verification.
- [x] Defer beta-code redemption until a verified session exists; beta-code signups land on `/subscriptions` after verification, with no code persisted in URLs or browser storage.
- [x] Test signup delivery, unverified-login blocking, successful verification, resend state, and redirect behavior.

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

## P0 — Must Fix Before Public Launch

- [ ] **Hard email verification and unified onboarding** — _pulled into the M1 section above._

~~Password reset flow~~ — ✅ done. ~~Mobile-responsive sidebar~~ — ✅ done (QA pass in Beta Gate).

---

## P1 — Core Product Gaps

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

- [ ] CSV export for payment history per tenant (owner use — tax / ITR filing)
- [ ] CSV export for all payments in a date range (all tenants, all properties)
- [ ] Consider: Excel (.xlsx) variant via `SheetJS` if demand warrants it

### Referral System

- [ ] Intentionally dormant for beta. Revisit only when referrals become a planned feature.

---

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

- [ ] **Admin panel** — manage users, plans, beta codes, subscriptions without CLI (replaces `db:beta-code` script). Separate `apps/admin` or a protected `/admin` route in `apps/dashboard`
- [ ] **Two-factor authentication** — Better Auth supports TOTP; SecurityTab already has disabled placeholder buttons
- [ ] **Audit log** — track all mutations (who changed what, when) for tenant disputes. New `auditLogs` table + `auditMiddleware` on ownerProcedure
- [ ] **Tenant communication history** — store sent emails in a `tenantMessages` table so owners can see past correspondence
- [ ] **Multi-property analytics** — per-property revenue breakdown, occupancy rate over time, vacancy duration tracking
- [ ] **`@react-pdf/renderer` upgrade** — replace `window.print()` receipt approach with a proper PDF blob for email attachments via Resend
- [ ] **Vacancy report** — units vacant for > N days, time-to-fill tracking

---

## Known Technical Debt

- [x] `notifications-tab.tsx` — `// TODO: migrate from localStorage` comment. Preferences now use owner-scoped database storage.
- [x] `buildReceiptMessage()` in `payment.ts` — replaced with shared KeyHQ HTML templates in `@rently/email`
- [ ] `referrers` table is intentionally dormant for beta; revisit only when referrals become a planned feature.
- [ ] `evlog` console.log calls — several `// TODO: remove before prod` comments across API handlers
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
