# Bug-2026-09-03-ledger-integrity — Ledger & Lifecycle Integrity Fixes

> Branch: `fix/ledger-integrity-2026-09-03` off `main@2250e3f`
> Risk tier: **High-risk** (payments, credits, authz, lifecycle) — full loop: Map + Constrain + Plan + Bug trace + rollback
> Baseline tag: `pre-ledger-integrity`
> Github-centric: no manual `wrangler` deploy/push; validate via CI + `rently_test`.
> Packages live under `packages/api` (no `apps/server`).

## Found — two independent reviews (Muse 1.3, Luna) cross-checked against `main@2250e3f`

Settlement/money (payments, credits, utilities):

- **S1 (P0)** Settlement races — `createPayment`, `createAgreementPayment`, `createCredit`, `recordUtilityPayment` are read-then-write. Neon HTTP (`packages/db/src/index.ts:28-36`) is the production path and cannot `FOR UPDATE`; `db.batch()` has no row locks. Two concurrent full-settlement payments can both succeed; two credits can over-discount. `payment.ts:161-242`, `credit.ts:83-115,117-156`.
- **S2 (P0)** Ledger immutability — `updatePayment` can change `amount/type/utilityId` without due recalc, allows cross-lease move and `utilityId: null` detach (`payment.ts:400-467`, `UpdatePaymentSchema`). `updateUtility` silently reassigns `leaseId` via `...input.data` spread (`utility.ts:316-323`). `voidPaymentGroup` never syncs `utilities.isPaid` (`payment.ts:725-735`).
- **S3 (P1)** Overdue ignores discounts and net reversals — `overdue.ts:57` compares `paidAmount >= rent` without `creditAmount`; `overdue-query.ts:45-68` sums only current-period `type==RENT` and excludes `REVERSAL`. `rent-cycle.ts:141` already does `effectiveRent = rent + creditAmount`, so dashboard vs email disagree.
- **S4 (P1)** Stale `isPaid` — `recordUtilityPayment` checks `utility.isPaid` then unconditionally sets true (`utility.ts:630-694`); credit create/reverse never sync `utilities.isPaid`; `getMyUtilities` returns the stored flag, not derived `amountDue`.

Lifecycle:

- **S5 (P0)** `terminateLease` unconditionally + repeatably sets unit `available` (stale second terminate evicts Lease-B); `updateLease` sets unit `occupied` without availability check and allows `rent` edit on active leases; `removeTenant` bulk-frees units with no still-mine check.

Auth isolation:

- **S6 (P0)** `updateTenant` authorizes against one active lease then updates every `tenantProfiles` row + the global `user` email/name/phone (`tenant.ts:568-612`). Owner-A can overwrite Owner-B's profile/identity.

Batch/portal/export + housekeeping:

- **S7 (P1)** `createUtilityBatch` clamps decreasing readings to 0 and always charges `units*rate+fixed` including maintenance (single path uses `computeTotalPaisa`); per-item `leaseId` silently dropped; `submitMyReading`/`getMyActiveLease` use blind `LIMIT 1`; missing soft-delete predicates; voided payments lock `updateUtility`; `assertMethodAllowedForRole` is inverted; export omits `deletedAt`.

## Deferred (not in this branch)

- **Period-aware rent due (#2 in reviews)** — `getAmountDueForRent` sums lifetime `rent + credits − paid`; month-two rent can read as already paid. Explicitly labelled future work in `credit.helpers.ts:48` + `TODO.md:244`. Needs a period-key migration and migration of all readers → separate `feat/period-aware-rent` branch.

## Plan — Slices (one logical change per commit, approval-gated)

| # | Tier | Slice | Files | Migration? |
|---|------|-------|-------|------------|
| S1 | High | **Settlement integrity** — idempotency key columns + partial unique indexes; row-lock + revalidate on tx path; client double-click sends same key | `schema.ts`, `payment.ts`, `credit.ts`, `utility.ts`, `tenant-portal.ts`, `validators/{payment,utility}.ts`, dashboard/tenant mutations | **Yes `0022`** |
| S2 | Medium | **Ledger immutability** — restrict `updatePayment`; drop `updateUtility` leaseId; sync `isPaid` in `voidPaymentGroup` | `payment.ts`, `utility.ts`, `validators/{payment,utility}.ts` | No |
| S3 | Medium | **Overdue discount + reversal** — include credits + net reversals; compare vs `effectiveRent` | `overdue.ts`, `overdue-query.ts` | No |
| S4 | Medium | **Derived credit/payment state** — replace stale `isPaid` gates with derived `amountDue`; sync on credit create/reverse | `utility.ts`, `tenant-portal.ts`, `credit.ts` | No |
| S5 | High | **Lifecycle integrity** — idempotent terminate, guarded transitions, still-mine release | `lease.ts`, `tenant.ts`, `validators/lease.ts` | No |
| S6 | High | **Auth isolation** — scope tenant writes by `createdById`, stop global `user` overwrite | `tenant.ts` | No |
| S7 | Medium | **Batch/portal/export + housekeeping** — batch pricing, lease selection, soft-delete, voided lock, method-role helper, export filters | `utility.ts`, `tenant-portal.ts`, `lease.ts`, `receipt.ts`, `payment-export-query.ts`, `validators/utility.ts` | No |

**Execution order:** S1 → S2 → S3 → S4 (money), S5 (lifecycle), S6 (auth), S7 (batch/housekeeping). Each slice is independently PR-ready.

## Verified — checklist per slice

Trivial: `bun run check-types` (6/6)
Small: `check-types` + focused `vitest run <file>`
Medium/High: `check-types` + `bunx biome check <files>` + `vitest run` (focused, `rently_test`) + `bun run build`. S1 also `db:generate` (no drift) + `db:migrate:test`.
