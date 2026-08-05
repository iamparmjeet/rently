# KeyHQ — TODO

> Single source of truth for build progress.
> Update this file as items are completed or priorities shift.
> Tiers: **P0** = must ship before public launch · **P1** = core product gaps · **P2** = growth features · **P3** = post-launch backlog
> Last audited: 2026-08-05 (verified against the KeyHQ beta branch)
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
- [x] **Beta code redemption** — `redeemBetaCode` procedure (transactional, atomic increment) wired in BillingTab, `/subscriptions` page, and register flow. Codes generated via `db:beta-code` seed script (admin panel is the P3 replacement).
- [x] **In-app notifications** — `notifications` table + router (list with lazy lease-expiry creation, unread count, mark read/all) + header bell with polling. Cron-free by design.
- [x] **R2 owner avatar upload** — presigned URL flow with key-scoping guard, `useUploadAvatar`/`useDeleteAvatar`, wired in ProfileTab.
- [x] **Mobile sidebar (Sheet variant)** — shared `Sidebar` renders a `Sheet` on mobile via `useIsMobile()`; `SidebarTrigger` in the header opens it.

---

## 🚀 Beta Release Gate — must complete before beta opens

> Gate test: "Can a stranger sign up, use the product, pay me, and recover their account without manual intervention?"

- [ ] **Email verification for owners** — no `emailVerification` config in Better Auth yet; register hook's `callbackURL` assumes it exists. Wire `sendVerificationEmail` via `@rently/email`. Decide: `requireEmailVerification` on (blocks login until verified) vs. soft banner.
- [ ] **Mobile QA pass** — test the dashboard and tenant portal on a real Android phone and a narrow iPhone viewport. `SidebarTrigger` is already the mobile menu control.
- [x] **`referrers` table decision** — leave it dormant during beta; no procedures or UI yet.

### Fast-follow (beta week 1–2, not gating)

- [ ] PDF rent receipts — design complete; key differentiator (tenant HRA claims). See P1 for sub-tasks.
- [ ] Subscription status badge in sidebar

---

## In Progress 🚧

### Notification Preferences + Email Triggers _(Milestone 6)_

> In-app notifications are DONE. This section is only the preference-driven email layer.

- [ ] Create one owner-scoped `notificationPreferences` row with `paymentReceived`, `utilityBillGenerated`, `leaseExpiryAlert`, `rentDueReminder`, `overdueAlert`, and `updatedAt`.
- [ ] Replace `localStorage` with owner-scoped query and mutation hooks.
- [ ] Wire `paymentReceived` toggle → send email on `createPayment` success
- [ ] Wire `utilityBillGenerated` toggle → send email when a utility bill is approved/generated.
- [ ] Convert `buildReceiptMessage()` to the shared KeyHQ HTML email wrapper.
- [ ] Scheduled preference-driven email reminders follow in Milestone 7.

### Private Tenant Documents _(Milestone 2 — Tenant Trust Workflows)_

- [ ] Create `tenantDocuments`; store a private R2 key, document type/version, masked identifier, consent, status, submitter/reviewer metadata, notes, and audit timestamps.
- [ ] Never add public document URL columns to `tenantProfiles` or return permanent public URLs. Provide short-lived, owner/tenant-authorized signed download URLs only.
- [ ] Store only Aadhaar last four digits in PostgreSQL; require masked Aadhaar uploads and label reviews as “owner reviewed,” never UIDAI verified.
- [ ] Keep Aadhaar uploads behind a production compliance feature flag.
- [ ] Implement `submitInitialDocument`, `reviewTenantDocument`, and `getPrivateDocumentDownloadUrl` with owner/tenant authorization tests.
- [ ] Add tenant upload and owner review UI in the portal/dashboard Docs experiences.

### Document Update Lifecycle _(Milestone 2 — Tenant Trust Workflows)_

- [ ] Initial submission: `pending → verified | rejected`.
- [ ] Later changes: `pending request → approved → submitted → completed`, with terminal `rejected | expired` states.
- [ ] An approved update request opens a 48-hour submission window; the prior verified document remains active until final approval.
- [ ] Implement `createDocumentUpdateRequest`, `reviewDocumentUpdateRequest`, and `submitApprovedDocumentUpdate` with authorization and expiry tests.

---

## P0 — Must Fix Before Public Launch

- [ ] **Email verification for owners** — _pulled into Beta Gate above._ The only remaining P0.

~~Password reset flow~~ — ✅ done. ~~Mobile-responsive sidebar~~ — ✅ done (QA pass in Beta Gate).

---

## P1 — Core Product Gaps

### Rent Cycle + Cloudflare Cron _(Milestone 7)_

- [ ] Create `queryRentCycleRows`, `computeRentCycleItem`, period-key generation, and configurable owner grace days (default: zero).
- [ ] Create a scheduled-email delivery deduplication table with a unique owner/lease/type/period/threshold key. Cloudflare Cron delivery is at-least-once, so this database constraint—not an in-memory lock—prevents duplicate emails.
- [ ] Export both `fetch` and `scheduled` handlers from the Worker entry point.
- [ ] Configure the Worker with `"triggers": { "crons": ["30 2 * * *"] }`; Cloudflare cron uses UTC, so this runs at 08:00 IST.
- [ ] Start with this single Cloudflare Free-plan trigger. Reassess only if the job cannot stay within its 10 ms CPU / 50 external-subrequest limits, or if more than five account-level Cron Triggers are needed.
- [ ] In `scheduled()`, await the reminder job; reserve `ctx.waitUntil()` for separately tracked concurrent work.
- [ ] Send lease-expiry reminders at 30, 7, and 1 days; rent-due reminders on each owner’s configured lead day; and period-aware overdue reminders after the owner grace period.
- [ ] Respect notification preferences and use the deduplication record before every email attempt.
- [ ] Keep total transactional email volume within the active email provider’s free quota; currently, Resend Free permits 3,000 emails/month and 100/day. Reassess paid email only when observed beta volume requires it.
- [ ] Test repeated scheduled executions, Asia/Kolkata date boundaries, and notification-preference enforcement. During local development, trigger the handler through Wrangler’s `/__scheduled` endpoint.

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

- [ ] `notifications-tab.tsx` — `// TODO: migrate from localStorage` comment. Preferences need DB storage before any email trigger can read them
- [ ] `buildReceiptMessage()` in `payment.ts` — plain text email body. Replace with HTML template consistent with `@rently/email`
- [ ] `referrers` table is intentionally dormant for beta; revisit only when referrals become a planned feature.
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
