# rently

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
- **Oxlint** - Oxlint + Oxfmt (linting & formatting)

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@rently/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Git Hooks and Formatting

- Format and lint fix: `bun run check`

## Project Structure

```
rently/
├── apps/
│   ├── web/         # Frontend application (Next.js)
│   └── server/      # Backend API (Hono, ORPC)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── api/         # API layer / business logic
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `bun run dev`: Start all applications in development mode
- `bun run build`: Build all applications
- `bun run dev:web`: Start only the web application
- `bun run dev:server`: Start only the server
- `bun run check-types`: Check TypeScript types across all apps
- `bun run db:push`: Push schema changes to database
- `bun run db:generate`: Generate database client/types
- `bun run db:migrate`: Run database migrations
- `bun run db:studio`: Open database studio UI
- `bun run check`: Run Oxlint and Oxfmt

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
  - [ ] Redirect authenticated users from /login to /dashboard
  - [x] Middlewares

- [ ] API Client
  - [ ] Install @tanstack/react-query and @tanstack/react-query-devtools
  - [ ] Create src/lib/api-client.ts (fetch wrapper with auth headers)
  - [ ] Create src/components/providers/query-provider.tsx
  - [ ] Wrap app with <QueryProvider> in src/app/layout.tsx

- [ ] Dashboard Layout
  - [x] Build src/components/layouts/dashboard-header.tsx (full implementation)
  - [x] Build src/components/layouts/deashboard-sidebar.tsx
  - [x] Add sidebar navigation links
  - [ ] Add mobile responsive hamburger menu
  - [x] Connect sidebar to dashboard layout

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
