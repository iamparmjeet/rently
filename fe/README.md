
- [ ] Auth Integration (FE)
  - [x] Install better-auth React package in fe
  - [x] Create src/lib/auth.ts with better-auth exports
  - [ ] Create src/components/providers/auth-provider.tsx
  - [ ] Wrap app with <AuthProvider> in src/app/layout.tsx
  - [ ] Fix login page to use auth.signIn() instead of raw fetch
    - [ ] Login with email
    - [ ] Login with social
    - [ ] On Existing User signup
    - [ ] Email Verficiation
    - [ ] Reset Password
      - [ ] Revoking Sessions on Password Reset
    - [ ] Update Password
  - [ ] Fix register page to use auth.signUp() instead of raw fetch
  - [ ] Add session state checking on login/register success
  - [ ] Add useSession() hook to dashboard layout

- [ ] Route Protection
  - [ ] Create src/components/guards/protected-route.tsx
  - [ ] Protect all /dashboard/* routes with auth guard
  - [ ] Redirect unauthenticated users to /login
  - [ ] Redirect authenticated users from /login to /dashboard

- [ ] API Client
  - [ ]  Install @tanstack/react-query and @tanstack/react-query-devtools
  - [ ] Create src/lib/api-client.ts (fetch wrapper with auth headers)
  - [ ] Create src/components/providers/query-provider.tsx
  - [ ] Wrap app with <QueryProvider> in src/app/layout.tsx

- [ ] Dashboard Layout
  - [ ] Build src/components/layouts/dashboard-header.tsx (full implementation)
  - [ ] Build src/components/layouts/deashboard-sidebar.tsx
  - [ ] Add sidebar navigation links
  - [ ] Add mobile responsive hamburger menu
  - [ ] Connect sidebar to dashboard layout


- [ ] Forms (All empty files)
  - [ ] Implement src/components/forms/property-form.tsx
  - [ ] Implement src/components/forms/unit-form.tsx
  - [ ] Implement src/components/forms/lease-form.tsx
  - [ ] Implement src/components/forms/payment-form.tsx
  - [ ] Implement src/components/forms/invite-form.tsx

- [ ] Feature Components (Empty files)
  - [ ] Implement src/components/features/properties/property-card.tsx
  - [ ] Implement src/components/features/properties/property-list.tsx
  - [ ] Implement src/components/features/properties/property-table.tsx
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
  - [ ] Implement src/app/(dashboard)/properties/page.tsx
  - [ ] Implement src/app/(dashboard)/properties/new/page.tsx
  - [ ] Implement src/app/(dashboard)/properties/[id]/page.tsx
  - [ ] Implement src/app/(dashboard)/properties/[id]/edit/page.tsx
  - [ ] Implement src/app/(dashboard)/units/page.tsx
  - [ ] Implement src/app/(dashboard)/units/new/page.tsx
  - [ ] Implement src/app/(dashboard)/units/[id]/page.tsx
  - [ ] Implement src/app/(dashboard)/units/[id]/edit/page.tsx
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
