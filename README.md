# rently

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines Next.js, Hono, ORPC, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **Next.js** - Full-stack React framework
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Hono** - Lightweight, performant server framework
- **oRPC** - End-to-end type-safe APIs with OpenAPI integration
- **Bun** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Better-Auth
- **Turborepo** - Optimized monorepo build system
- **Biome** - Linting and formatting

rently/
├── apps/
│ ├── web/ # Frontend application (Next.js)
│ └── server/ # Backend API (Hono, ORPC)
├── packages/
│ ├── ui/ # Shared shadcn/ui components and styles
│ ├── api/ # API layer / business logic
│ ├── auth/ # Authentication configuration & logic
│ └── db/ # Database schema & queries

```

## Frontend

- [ ] Auth Integration (FE)
  - [x] Install better-auth React package in fe
  - [x] Create src/lib/auth.ts with better-auth exports
  - [ ] Create src/components/providers/auth-provider.tsx
  - [ ] Wrap app with <AuthProvider> in src/app/layout.tsx
  - [ ] Fix login page
    - [x] Using better auth use.login()
    - [x] Login with email
    - [x] Login with social
    - [ ] On Existing User signup
    - [ ] Email Verficiation
    - [ ] Reset Password
      - [ ] Revoking Sessions on Password Reset
    - [ ] Update Password
  - [x] Fix register page to use auth.signUp() instead of raw fetch
    - [x] Social signin
  - [ ] Add session state checking on login/register success
  - [x] Add useSession() hook to dashboard layout

- [ ] Route Protection
  - [ ] Create src/components/guards/protected-route.tsx
  - [x] Protect all /dashboard/\* routes with auth guard
  - [x] Redirect unauthenticated users to /login
  - [x] Redirect authenticated users from /login to /dashboard
  - [x] Middlewares

- [x] API Client
  - [x] Install @tanstack/react-query and @tanstack/react-query-devtools
  - [x] Create src/lib/api-client.ts (fetch wrapper with auth headers)
  - [x] Create src/components/providers/query-provider.tsx
  - [x] Wrap app with <QueryProvider> in src/app/layout.tsx

- [ ] Dashboard Layout
  - [x] Build src/components/layouts/dashboard-header.tsx (full implementation)
  - [x] Build src/components/layouts/deashboard-sidebar.tsx
  - [x] Add sidebar navigation links
  - [ ] Add mobile responsive hamburger menu
  - [x] Connect sidebar to dashboard layout

- [ ] Forms (All empty files)
  - [x] Implement src/components/forms/property-form.tsx
  - [x] Implement src/components/forms/unit-form.tsx
  - [ ] Implement src/components/forms/lease-form.tsx
  - [ ] Implement src/components/forms/payment-form.tsx
  - [ ] Implement src/components/forms/invite-form.tsx

- [ ] Feature Components (Empty files)
  - [x] Implement src/components/features/properties/property-card.tsx
  - [x] Implement src/components/features/properties/property-list.tsx
  - [x] Implement src/components/features/properties/property-table.tsx
  - [ ] Implement src/components/features/leases/lease-card.tsx
  - [ ] Implement src/components/features/leases/lease-details.tsx
  - [ ] Implement src/components/features/leases/lease-status-badge.tsx
  - [ ] Implement src/components/features/payments/payment-history.tsx
  - [ ] Implement src/components/features/payments/payment-methods.tsx
  - [ ] Implement src/components/features/subscriptions/plan-card.tsx
  - [ ] Implement src/components/features/subscriptions/subscription-status.tsx

- [ ] Shared Components (Empty files)
  - [ ] Implement src/components/shared/confirm-dialog.ts
  - [ ] Implement src/components/shared/data-table.tsx
  - [ ] Implement src/components/shared/empty-state.tsx
  - [ ] Implement src/components/shared/error-boundary.tsx
  - [ ] Implement src/components/shared/loading-spinner.tsx

- [ ] Dashboard Pages (Empty return statements)
  - [x] Implement src/app/(dashboard)/properties/page.tsx
  - [x] Implement src/app/(dashboard)/properties/new/page.tsx
  - [x] Implement src/app/(dashboard)/properties/[id]/page.tsx
  - [x] Implement src/app/(dashboard)/properties/[id]/edit/page.tsx
  - [x] Implement src/app/(dashboard)/units/page.tsx
  - [x] Implement src/app/(dashboard)/units/new/page.tsx
  - [x] Implement src/app/(dashboard)/units/[id]/page.tsx
  - [x] Implement src/app/(dashboard)/units/[id]/edit/page.tsx
  - [ ] Implement src/app/(dashboard)/leases/page.tsx
  - [ ] Implement src/app/(dashboard)/leases/new/page.tsx
  - [ ] Implement src/app/(dashboard)/leases/[id]/page.tsx
  - [ ] Implement src/app/(dashboard)/payments/page.tsx
  - [ ] Implement src/app/(dashboard)/payments/[id]/page.tsx
  - [ ] Implement src/app/(dashboard)/tenants/page.tsx
  - [ ] Implement src/app/(dashboard)/tenants/[id]/page.tsx
  - [ ] Implement src/app/(dashboard)/tenants/invites/page.tsx
  - [ ] Implement src/app/(dashboard)/utilities/page.tsx
  - [ ] Implement src/app/(dashboard)/utilities/[id]/page.tsx
  - [ ] Implement src/app/(dashboard)/settings/page.tsx
  - [ ] Implement src/app/(dashboard)/settings/profile/page.tsx
  - [ ] Implement src/app/(dashboard)/subscriptions/page.tsx
  - [ ] Implement src/app/(dashboard)/subscriptions/plans/page.tsx
  - [ ] Implement src/app/(dashboard)/subscriptions/billing/page.tsx

---

// Pending tasks
Logic Description Solution

- [ ] Aggregate rent view combine utilities + base rent per tenant create service: RentSummaryService.getTenantBill(leaseId)
- [ ] Admin management required for user and plan control add /admin routes
- [ ] Trial expiry automation mark expired subscriptions add daily cron (bun or system cron)
- [ ] Payment aggregation show total paid vs due per lease SQL SUM(amount) group queries
- [ ] Invite email sending actual delivery layer missing add Resend/email.js or nodemailer
- [ ] Tenant utilities union separate and combine utility costs implement aggregated query
- [ ] Audit updatedBy, track who changes lease/payments add updated_by FK

// Enhancements

// Category Suggested Enhancement

- [ ] Auth Link invite → user signup flow auto-role assignment
- [ ] Accounting Utility + Payment summaries per tenant
- [ ] DB Add foreign key cascades; non-null constraints
- [ ] Notifications Email invite acceptance, subscription expiry alerts
- [ ] Type-safety Add safeHandler() for consistent responses
- [ ] Roles Separate admin/tenant routes
- [ ] Subscriptions Add renewal handling job/cron
- [ ] RPC Implement Hono RPC client as typed bridge to FE
- [ ] Infra Add CORS + rate-limiting middleware
```
