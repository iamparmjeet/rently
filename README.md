# KeyHQ

> **Property management SaaS built for Indian landlords.**
> Manage properties, units, tenants, leases, utility billing, and rent payments — all from one dashboard.

[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Bun](https://img.shields.io/badge/Bun-1.3-f9f1e1?style=flat-square&logo=bun&logoColor=black)](https://bun.sh/)
[![Turborepo](https://img.shields.io/badge/Turborepo-2.x-EF4444?style=flat-square&logo=turborepo&logoColor=white)](https://turbo.build/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](./LICENSE)

**Live:** [KeyHQ.parmjeetmishra.com](https://keyhq.parmjeetmishra.com)

**Release:** `v0.1.0-beta.2` — the public beta is live. See the [changelog](./CHANGELOG.md) for release notes.

---

## What is KeyHQ?

KeyHQ is a multi-tenant SaaS for property owners who rent residential or commercial spaces. It handles the full lifecycle of a rental:

- An **owner** registers, adds their properties and units, creates leases, and tracks payments.
- A **tenant** receives an invite email, sets a password, and lands in a dedicated portal where they see their lease, dues, and utility readings — and can submit meter readings themselves.
- All monetary values are stored as **integers in paise** (₹ × 100) to avoid floating-point errors in financial calculations.

---

## Monorepo Structure

```
rently/                          ← Turborepo root
├── apps/
│   ├── web/                     ← Marketing site + auth flows (port 3001)
│   ├── dashboard/               ← Owner portal (port 3002)
│   ├── tenant/                  ← Tenant portal (port 3003)
│   ├── admin/                   ← Private KeyHQ operations app (port 3004)
│   └── server/                  ← Hono API server / Cloudflare Workers entry
└── packages/
    ├── api/                     ← oRPC routers + all business logic
    ├── auth/                    ← Better Auth configuration
    ├── db/                      ← Drizzle schema, migrations, constants
    ├── validators/              ← Zod schemas derived from Drizzle tables
    ├── hooks/                   ← Shared TanStack Query hooks
    ├── ui/                      ← Shared component library (Base UI + shadcn)
    ├── email/                   ← Resend transactional email templates
    ├── env/                     ← T3 Env typed environment variables
    └── config/                  ← Shared tsconfig.base.json
```

### App responsibilities

| App              | Port | Who uses it | What it does                                           |
| ---------------- | ---- | ----------- | ------------------------------------------------------ |
| `apps/web`       | 3001 | Everyone    | Landing page, `/login`, `/register`, invite acceptance |
| `apps/dashboard` | 3002 | Owners      | Full property management UI                            |
| `apps/tenant`    | 3003 | Tenants     | Lease overview, bills, payments, meter readings        |
| `apps/admin`     | 3004 | KeyHQ staff | User support, subscriptions, beta codes, audit history |
| `apps/server`    | 3000 | Internal    | Hono + oRPC API, auth handler, OpenAPI docs            |

---

## Tech Stack

### Backend

| Layer       | Tool                         | Version |
| ----------- | ---------------------------- | ------- |
| Runtime     | Bun                          | 1.3.x   |
| HTTP server | Hono                         | 4.x     |
| API layer   | oRPC (`@orpc/server`)        | 1.x     |
| ORM         | Drizzle ORM                  | 0.45.x  |
| Database    | PostgreSQL (Neon serverless) | 16      |
| Auth        | Better Auth                  | 1.6.x   |
| Email       | Resend                       | 6.x     |
| Validation  | Zod                          | v4      |
| Logging     | evlog                        | 2.x     |

### Frontend

| Layer        | Tool                  | Version |
| ------------ | --------------------- | ------- |
| Framework    | Next.js App Router    | 16.x    |
| Server state | TanStack Query        | v5      |
| Forms        | React Hook Form + Zod | 7.x     |
| Styling      | Tailwind CSS          | v4      |
| Components   | Base UI + shadcn/ui   | v2      |
| Icons        | @tabler/icons-react   | 3.x     |
| Toasts       | Sonner                | 2.x     |

### Tooling

| Tool        | Purpose                                             |
| ----------- | --------------------------------------------------- |
| Turborepo   | Monorepo build orchestration + caching              |
| Biome       | Linting and formatting (replaces ESLint + Prettier) |
| Lefthook    | Git hooks (commit-msg + pre-push typecheck)         |
| commitlint  | Conventional Commits enforcement                    |
| tsdown      | Server bundle compilation                           |
| drizzle-kit | Schema migrations                                   |

---

## Architecture

### Request lifecycle

```
User action (form submit)
  → React Hook Form + Zod (client-side validation)
  → useMutation hook → oRPC client (@orpc/tanstack-query)
  → apps/server (Hono receives request)
  → createContext() → { db, headers }
  → RPCHandler → appRouter.rent.[domain].[procedure]
  → protectedProcedure validates Better Auth session cookie
  → Context gains { user, session }
  → Drizzle query runs against Neon PostgreSQL
  → ORPCError thrown on business rule violation
  → Response returned
  → queryClient.invalidateQueries() fires → UI re-renders
```

### oRPC router tree

```
appRouter
├── admin
│   ├── stats          overview
│   ├── users          list, get
│   ├── subscriptions  list, recordPayment
│   ├── betaCodes      list, create, expire
│   └── auditLogs      list
└── rent
    ├── property   list, get, create, update, delete      ✅
    ├── unit       list, get, create, update, delete      ✅
    ├── lease      list, get, create, update, delete      ✅
    ├── tenant     list, get, update, verify, sendEmail   ✅
    ├── invite     list, get, create, resend, accept,     ✅
    │              cancel
    ├── payment    list, get, create, update, delete      ✅
    └── utility    list, get, create, update, delete      ✅
```

### Auth & routing

- All auth UI lives in `apps/web`. After sign-in, routing is role-based:
  - `role: owner` → redirected to `apps/dashboard`
  - `role: tenant` → redirected to `apps/tenant`
  - `role: admin` → redirected to `apps/admin`
- Cross-app navigation uses `window.location.replace()` with `NEXT_PUBLIC_*` env vars — never `router.push()`, which only works within a single Next.js app.
- Route protection is handled by `proxy.ts` in each app — **there is no `middleware.ts`**.

### Multi-tenancy isolation

Every owner-scoped query is filtered by `ctx.user.id`. Ownership helpers (`VerifyUnitOwnership`, `VerifyLeaseOwnership`) throw `ORPCError('FORBIDDEN')` before any mutation can touch data belonging to another owner.

---

## Features

### Owner dashboard (`apps/dashboard`)

- **Properties** — CRUD with property type (residential/commercial) and address
- **Units** — per-property units with type, rent amount, status (vacant/occupied)
- **Tenants** — invite-based onboarding; private per-document upload, consent, review, replacement, and purge workflow
- **Leases** — link tenant ↔ unit with start/end date, rent amount, deposit
- **Utilities** — electricity meter readings per unit; bill calculation
- **Payments** — rent, utility, and deposit payment records
- **Dashboard** — occupancy rate, revenue chart (12-month), recent transactions, upcoming dues
- **Settings** — profile, owner-avatar upload, security (password change), currency preference, and billing

### Tenant portal (`apps/tenant`)

- **Overview** — current lease summary, welcome card
- **Bill tab** — current month rent + utility breakdown
- **Payments tab** — payment history
- **Readings tab** — submit electricity meter readings
- **Documents tab** — private six-document upload, consent, owner review, replacement, and short-lived download workflow

### Auth flows (`apps/web`)

- Email/password registration and login
- Google and GitHub OAuth
- Invite-based tenant onboarding (token → set password → role assigned)
- Session-based auth via cookie (Better Auth)

---

## Database Schema

### Rent domain

| Table                    | Description                                       |
| ------------------------ | ------------------------------------------------- |
| `properties`             | Top-level asset owned by a user                   |
| `units`                  | Rentable unit inside a property                   |
| `leases`                 | Contract linking a tenant to a unit               |
| `utilities`              | Electricity meter readings per lease              |
| `payments`               | Financial transactions (rent / utility / deposit) |
| `tenantInvites`          | Owner-created invite token with expiry            |
| `tenantProfiles`         | Extended tenant profile, legacy PAN hint, and Aadhaar last four |
| `ownerProfiles`          | Extended owner profile (GST, UPI, company name)   |
| `tenantDocuments`        | Private document versions, consent, review, and purge metadata |
| `documentUpdateRequests` | Tenant-requested replacement lifecycle             |

### Subscription domain

| Table           | Description                |
| --------------- | -------------------------- |
| `plans`         | Pricing tiers              |
| `subscriptions` | Active plan per owner      |
| `invoices`      | Per-billing-period records |
| `adminAuditLogs` | Audited KeyHQ admin mutations |

All primary keys are **UUIDv7** — time-ordered, app-generated, no PostgreSQL extension required.

---

## Local Development

### Prerequisites

- [Bun](https://bun.sh/) ≥ 1.3
- [Docker](https://www.docker.com/) (for local PostgreSQL)
- Node.js is **not** required — Bun handles everything

### 1. Clone and install

```bash
git clone https://github.com/iamparmjeet/rently.git
cd rently
bun install
```

### 2. Start the local database

```bash
# Starts a PostgreSQL 18.6 container (matching the Neon database version)
cd packages/db
bun run db:start
```

### 3. Configure environment variables

Copy the example env files and fill in values:

```bash
# Server
cp apps/server/.env.example apps/server/.env

# Frontend apps share the same client variables
cp apps/web/.env.example apps/web/.env.local
cp apps/web/.env.example apps/dashboard/.env.local
cp apps/web/.env.example apps/tenant/.env.local
cp apps/admin/.env.example apps/admin/.env.local
```

See [Environment Variables](#environment-variables) below for all required keys.

### 4. Run migrations and seed

```bash
bun run db:generate    # generate migration files from schema
bun run db:migrate:local # apply migrations to local rently_dev
bun run db:seed:local  # seed subscription plans locally
```

### Refresh local data from Neon

To test against production-shaped data without sending application queries to
production, restore a Neon dump into the local-only `rently_dev` database:

```bash
bun run --filter @rently/db db:start
SOURCE_DATABASE_URL="$(grep '^DATABASE_URL=' apps/server/.env | cut -d= -f2-)" bun run db:refresh:local
bun run db:migrate:local
bun run dev:server:local-db
```

`db:refresh:local` refuses any target other than `localhost:5432/rently_dev`.
It replaces that local database only; it never writes to the source Neon
database. Docker Postgres validates standard PostgreSQL SQL and migrations.
Run an additional smoke test against a separate Neon branch when testing
Neon HTTP batch behavior.

### 5. Start the dev servers

```bash
# All apps in parallel (recommended)
# Uses local Docker PostgreSQL (`rently_dev`), never production Neon.
bun run dev

# Or individually
bun run dev:server     # API server — port 3000
bun run dev:web        # Marketing + auth — port 3001
bun run dev:dashboard  # Owner portal — port 3002
bun run dev:tenant     # Tenant portal — port 3003
bun run dev:admin      # Private operations app — port 3004
```

---

## Environment Variables

### `apps/server/.env`

```env
# Database
DATABASE_URL=postgresql://rently_db_user:rently_db_password@localhost:5432/rently_db
# Neon URLs use the serverless HTTP driver; other PostgreSQL URLs use node-postgres.

# Auth
BETTER_AUTH_SECRET=             # min 32 chars — generate with: openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3001,http://localhost:3002,http://localhost:3003,http://localhost:3004
COOKIE_DOMAIN=localhost
WEB_APP_URL=http://localhost:3001

# OAuth providers (optional in development)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Email
RESEND_API_KEY=
EMAIL_FROM=noreply@yourdomain.com

# Cloudflare R2 (required by environment validation; use development credentials locally)
CLOUDFLARE_ACCOUNT_ID=
R2_BUCKET_NAME=keyhq
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_PUBLIC_URL=https://keyhq-media.example.com
R2_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_PRIVATE_BUCKET_NAME=keyhq-private-documents
R2_PRIVATE_ACCESS_KEY_ID=
R2_PRIVATE_SECRET_ACCESS_KEY=
AADHAAR_UPLOADS_ENABLED=false

NODE_ENV=development
```

Tenant documents use the separate private R2 bucket above. Keep public access
disabled, do not attach a custom domain, and configure bucket CORS with only
the dashboard and tenant portal origins (including their local development
ports). The document API returns only short-lived presigned PUT/GET URLs.

### `apps/*/.env.local` (all four Next.js apps)

```env
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
NEXT_PUBLIC_WEB_URL=http://localhost:3001
NEXT_PUBLIC_DASHBOARD_URL=http://localhost:3002
NEXT_PUBLIC_TENANT_URL=http://localhost:3003
NEXT_PUBLIC_ADMIN_URL=http://localhost:3004
```

---

## Development Commands

```bash
# Run all apps
bun run dev

# Type-check entire monorepo
turbo run check-types

# Lint and format (Biome)
bun run check

# Database
bun run db:generate    # generate migrations from schema changes
bun run db:migrate     # apply pending migrations
bun run db:push        # push schema directly (dev only — no migration file)
bun run db:studio      # open Drizzle Studio GUI at localhost:4983
bun run db:seed        # seed initial data (subscription plans)
```

---

## Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/) enforced via commitlint + Lefthook.

```
<type>(<scope>): <description>

Types:  feat | fix | refactor | chore | style | build
Scopes: db | validators | api | auth | email | server | web | dashboard | tenant
        property | unit | tenant | lease | payment | utility | invite
```

Examples:

```
feat(dashboard): add revenue chart with 12-month aggregation
fix(api/lease): await ownership check before mutation
refactor(validators): extract PaymentListItemSchema to enriched layer
chore(deps): bump drizzle-orm to 0.45.2
```

---

## Project Status

| Area                                                                  | Status                         |
| --------------------------------------------------------------------- | ------------------------------ |
| Database schema + constants                                           | ✅ Complete                    |
| Zod validators (current domains)                                     | ✅ Complete                    |
| oRPC API (property, unit, lease, tenant, invite, payment, utility, notifications) | ✅ Complete                    |
| Better Auth configuration and password recovery                      | ✅ Complete                    |
| Hono server + oRPC wiring                                             | ✅ Complete                    |
| Owner dashboard — Properties, Units, Tenants, Leases, Utilities      | ✅ Complete                    |
| Owner dashboard — Payments, settings, and revenue dashboard          | ✅ Complete                    |
| Tenant portal — overview, bills, payments, readings, and profile/KYC-status tabs | ✅ Complete                    |
| Invite-based onboarding, delivery-failure feedback, and resend action | ✅ Complete                    |
| Role-based cross-app routing                                          | ✅ Complete                    |
| Subscriptions, plans, beta-code redemption, and UPI QR               | ✅ Complete                    |
| R2 owner-avatar upload                                                | ✅ Complete                    |
| Tenant meter-submission rate limiting                                 | ✅ Complete                    |
| Mobile sidebar                                                        | ✅ Complete — device QA pending |
| Hard email verification and unified tenant onboarding                 | ✅ Milestone 1                 |
| Private tenant document workflow and persisted replacement lifecycle  | ✅ Milestone 2                 |
| Mobile device and journey QA                                          | 📋 Milestone 3                 |
| Instant dashboard bootstrap                                           | 📋 Milestone 4                 |
| Print-optimized rent receipts                                         | 📋 Milestone 5                 |
| Persisted notification preferences and automatic tenant emails        | ✅ Milestone 6                 |
| Scheduled preference-driven email reminders                           | ✅ Milestone 7                 |
| Admin panel                                                           | 📋 Post-beta                   |

---

## License

MIT © [Parmjeet Mishra](https://parmjeetmishra.com)
