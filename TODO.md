# KeyHQ — TODO

> Single source of truth for build progress.
> Update this file as items are completed or priorities shift.
> Tiers: **P0** = must ship before public launch · **P1** = core product gaps · **P2** = growth features · **P3** = post-launch backlog
> Last audited: 2026-06-10 (verified against live codebase)

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
- [x] **Beta code redemption** — `redeemBetaCode` procedure (transactional, atomic increment) wired in BillingTab, `/subscriptions` page, and register flow. Codes generated via `db:beta-code` seed script (admin panel is the P3 replacement).
- [x] **In-app notifications** — `notifications` table + router (list with lazy lease-expiry creation, unread count, mark read/all) + header bell with polling. Cron-free by design.
- [x] **R2 owner avatar upload** — presigned URL flow with key-scoping guard, `useUploadAvatar`/`useDeleteAvatar`, wired in ProfileTab.
- [x] **Mobile sidebar (Sheet variant)** — shared `Sidebar` renders a `Sheet` on mobile via `useIsMobile()`; `MobileMenuTrigger` in header. ⚠️ Needs a device QA pass — see Beta Gate.

---

## 🚀 Beta Release Gate — must complete before beta opens

> Gate test: "Can a stranger sign up, use the product, pay me, and recover their account without manual intervention?"

- [ ] **Plans page** — verify/build `/subscriptions/plans` ("View Plans" CTA already links to it). Plan cards with feature comparison.
- [ ] **`UpgradeDialog` — UPI QR display** (`react-qr-code` + owner UPI flow) alongside the existing beta code form.
- [ ] **Email verification for owners** — no `emailVerification` config in Better Auth yet; register hook's `callbackURL` assumes it exists. Wire `sendVerificationEmail` via `@rently/email`. Decide: `requireEmailVerification` on (blocks login until verified) vs. soft banner.
- [ ] **Mobile QA pass** — test dashboard + tenant portal on a real phone. Known bug: `MobileMenuTrigger` renders `IconSearch` instead of a menu icon.
- [ ] **Decide: `referrers` table — build-later or drop** — decision only. Dropping after real users exist = riskier migration.

### Fast-follow (beta week 1–2, not gating)

- [ ] PDF rent receipts — design complete; key differentiator (tenant HRA claims). See P1 for sub-tasks.
- [ ] Subscription status badge in sidebar
- [ ] Clean stale comments: `// TODO: add owner reset email branch` in `packages/auth` (branch exists now)

---

## In Progress 🚧

### Notification Preferences + Email Triggers

> In-app notifications are DONE. This section is only the preference-driven email layer.

- [ ] Migrate preferences from `localStorage` to `ownerProfiles` column (or separate `notificationPrefs` table)
- [ ] Add DB migration for notification preference fields
- [ ] Wire `paymentReceived` toggle → send email on `createPayment` success
- [ ] Wire `utilityBillGenerated` toggle → send email on utility batch insert
- [ ] Wire `leaseExpiryAlert` / `rentDueReminder` toggles → Resend triggers (needs scheduled job — see P1)

### R2 File Uploads — remaining

- [ ] Tenant KYC document upload (UID / PAN image → R2) — currently a "coming soon" toast
- [ ] Add URL columns to `tenantProfiles` (`aadhaarDocUrl`, `panDocUrl`, …)
- [ ] `getPresignedTenantDocumentUrl` procedure (key pattern: `tenants/${tenantId}/documents/${docType}`)
- [ ] Display uploaded documents in tenant portal Docs tab

### Document Update Request Workflow _(defer past beta — low-frequency)_

- [ ] `DocumentUpdateRequestDialog` in tenant portal — tenant raises a request
- [ ] Owner review UI in dashboard (approve / reject with notes)
- [ ] `approveDocumentRequest` + `rejectDocumentRequest` oRPC procedures
- [ ] Status badge on tenant card (pending doc request indicator)

---

## P0 — Must Fix Before Public Launch

- [ ] **Email verification for owners** — _pulled into Beta Gate above._ The only remaining P0.

~~Password reset flow~~ — ✅ done. ~~Mobile-responsive sidebar~~ — ✅ done (QA pass in Beta Gate).

---

## P1 — Core Product Gaps

### Scheduled Jobs (lease + rent reminders)

- [ ] Choose a job scheduler — Vercel Cron (simplest, already on Vercel) or Upstash QStash (more reliable, retries)
- [ ] `GET /jobs/lease-expiry-check` endpoint — query leases expiring in 30 / 7 / 1 days, send Resend email per owner preference
- [ ] `GET /jobs/rent-due-reminder` endpoint — query leases where `rentDueDate` is N days away, notify owner + tenant
- [ ] Wire both endpoints to cron schedule (daily at 08:00 IST)
- [ ] Note: in-app lease-expiry notifications already exist via lazy creation in `listNotifications` — these jobs add the _email_ channel

### PDF Rent Receipts

- [ ] `getPaymentReceiptData` oRPC procedure — enriched JOIN (payment + owner profile + property + unit + tenant)
- [ ] `generateReceiptNumber(paymentId)` utility in `@rently/db/utils/receipt.ts` (deterministic from UUIDv7)
- [ ] `rupeesToWords(paise)` utility in `@rently/ui/lib/currency.ts` (Indian numbering — lakh/crore)
- [ ] `/receipts/[paymentId]` route in `apps/dashboard` — print-optimised HTML + `window.print()`
- [ ] `getMyPaymentReceiptData` oRPC procedure (tenant-scoped, `protectedProcedure`)
- [ ] `/receipts/[paymentId]` route in `apps/tenant`
- [ ] "Download" button in `PaymentDetailDialog` → `window.open('/receipts/[id]?print=true')`
- [ ] "Download" button in tenant portal payment history

### Late Payment / Overdue Tracking

- [ ] Define "overdue" — payment not recorded by `lease.rentDueDate` of the current month
- [ ] `getOverdueLeases` query — leases past due date with no rent payment this cycle
- [ ] Overdue badge on tenant card in dashboard
- [ ] Overdue summary card on revenue dashboard
- [ ] `overdueAlert` notification trigger (in-app notification system already supports new types)

### Data Export

- [ ] CSV export for payment history per tenant (owner use — tax / ITR filing)
- [ ] CSV export for all payments in a date range (all tenants, all properties)
- [ ] Consider: Excel (.xlsx) variant via `SheetJS` if demand warrants it

### Referral System

- [ ] Decision pending (see Beta Gate): build or drop `referrers` table
- [ ] If building: `createReferral` procedure, referral link generation, referral tracking on subscription redemption
- [ ] Referral status in Settings → Billing tab

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
- [ ] **Social login UI** — Google / GitHub. Hooks (`useSocialLogin`) already exist; needs buttons wired in login page
- [ ] **Tenant communication history** — store sent emails in a `tenantMessages` table so owners can see past correspondence
- [ ] **Multi-property analytics** — per-property revenue breakdown, occupancy rate over time, vacancy duration tracking
- [ ] **`@react-pdf/renderer` upgrade** — replace `window.print()` receipt approach with a proper PDF blob for email attachments via Resend
- [ ] **Vacancy report** — units vacant for > N days, time-to-fill tracking

---

## Known Technical Debt

- [ ] `notifications-tab.tsx` — `// TODO: migrate from localStorage` comment. Preferences need DB storage before any email trigger can read them
- [ ] `buildReceiptMessage()` in `payment.ts` — plain text email body. Replace with HTML template consistent with `@rently/email`
- [ ] `packages/auth/src/index.ts` — stale `// TODO: add owner reset email branch` comment (branch exists; delete comment)
- [ ] `MobileMenuTrigger` in dashboard header renders `IconSearch` instead of a menu/hamburger icon
- [ ] `referrers` table — exists in schema, no procedures, no UI. Decision in Beta Gate
- [ ] `evlog` console.log calls — several `// TODO: remove before prod` comments across API handlers
- [ ] Notification preference fields not declared in `turbo.json` env vars yet — add when migrated from localStorage
- [ ] README.md Project Status table is stale (says rate limiting "Planned", payments oRPC pending — both done)

---

## Deferred / Decided Against

| Item                                       | Decision                                                                                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Redis / Upstash for rate limiting          | DB-based count query is sufficient for beta scale. Revisit at 1000+ active tenants or multi-instance deployment                                 |
| `jsPDF` / `pdfmake` for receipts           | Browser `window.print()` produces better output with zero bundle cost. Server-side PDF generation (`pdf-lib`) only needed for email attachments |
| Separate `/new` and `/edit` routes         | All CRUD uses inline `FormDialog` pattern — keep consistent                                                                                     |
| Cron for in-app lease-expiry notifications | Lazy creation inside `listNotifications` — cron only needed for the _email_ channel (P1)                                                        |
