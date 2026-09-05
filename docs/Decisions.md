# Decisions

## 2026-09-05 - B08 individual settlement serialization

**Decision:** Serialize each individual settlement by its accounting scope: a
node-postgres transaction locks the lease or utility row before recalculating
the balance, while the Neon HTTP path performs an advisory lock, balance
recheck, conditional insert, and compatibility-flag update in one SQL
statement. Reversal insertion uses the same scope lock.

**Why:** B07's idempotency indexes only arbitrate retries with the same key.
Distinct keys can still both pass a read-before-write balance check. Neon HTTP
cannot use `FOR UPDATE`, so its single-statement transaction must make the
balance predicate part of the insert; node-postgres can use the existing row
lock pattern.

**Alternatives:** A schema-wide positive-payment uniqueness constraint (rejected:
partial payments and void-then-repay are valid); a new balance table (rejected:
larger schema and migration surface); advisory locks alone on node-postgres
(rejected: row locks already provide the stronger database-row protection).

**Tradeoff:** Neon uses PostgreSQL transaction-scoped advisory locks keyed by
lease or utility UUID, so requests sharing one accounting scope serialize even
when their idempotency keys differ. The existing exact-payment and credit-limit
rules remain unchanged.

**Model:** Codex GPT-5.6.

## 2026-09-04 - database URL is the only database selector

**Decision:** Use only `DATABASE_URL`; its hostname selects the runtime driver.
Local commands supply Docker Postgres and deployment supplies Neon.

**Why:** The combination of `DATABASE_URL`, `USE_NEON`, and a local override
created multiple sources of truth for one database connection. Simplifying the
configuration makes the selected database explicit, even though later
reproduction showed that the ₹1,200 payment failure itself was an aggregate
type-conversion bug rather than database routing.

**Alternatives:** Change the payment calculation (rejected: its paise arithmetic
and reversal netting are correct); retain a separate driver flag or override
variable (rejected: either can disagree with the actual URL).

**Tradeoff:** Driver selection depends on recognizing Neon hostnames, covered by
a focused regression test.

**Model:** GPT-5.6 Sol.

## 2026-09-05 - grouped-payment idempotency scope

**Decision:** Store grouped-payment idempotency metadata on `payment_groups`, with a
nullable request fingerprint and a partial unique index on
`(agreement_id, idempotency_key)`. Replay queries must join the agreement to its
owner's property and require the authenticated owner, requested agreement, and
key before returning any financial rows. A fingerprint mismatch is rejected as
the same key being reused for a different request.

**Why:** B07 placed the same key on each child allocation and replayed by key
alone, allowing a request on another agreement to receive the first group's
financial data. The group is the idempotency unit, while the agreement UUID is
globally unique and the owner is an authorization predicate rather than a
duplicated ledger column.

**Alternatives:** Keep searching child payments by key (rejected: it cannot
scope replay and has no single group-level request record); add owner ID to
payment groups (rejected: duplicates ownership already authoritative through
the agreement/property join); use a global key unique index (rejected: keys
are request-scoped and may safely be reused by different owners/agreements).

**Tradeoff:** Existing grouped rows remain legacy-compatible with null metadata;
only new grouped requests participate in the group-level index and fingerprint
validation. The fingerprint covers the canonical grouped-payment request fields
accepted by this API, not server-side balances that are intentionally bypassed
on a successful retry.

**Model:** GPT-5.6 Luna.

## 2026-09-04 - normalize monetary aggregates at the database boundary

**Decision:** Convert PostgreSQL monetary aggregate results to JavaScript
numbers before arithmetic. Rent outstanding includes rent payments and
reversals linked to rent payments; deposit and other payment types are excluded.

**Why:** PostgreSQL promotes `sum(integer)` to `bigint`, which node-postgres
returns as text. TypeScript's `sql<number>` annotation did not convert it at
runtime, causing `120000 + "0"` to concatenate into `1200000`. Treating every
non-utility payment as rent also allowed deposits to settle rent accidentally.

**Alternatives:** Cast the sum back to PostgreSQL `integer` (rejected: an
aggregate can exceed the column range); change rupee-to-paise conversion
(rejected: the submitted `120000` was correct); count every reversal (rejected:
a reversed deposit is not a rent adjustment).

**Tradeoff:** Reversal attribution relies on the existing convention that
`payments.referenceNumber` stores the original payment UUID for reversal rows.

**Model:** GPT-5.6 Sol.

## 2026-09-03 - settlement idempotency keys

**Decision:** Close the Neon HTTP settlement race with application-supplied idempotency keys backed by partial unique indexes, rather than row locks.

**Why:** `packages/db/src/index.ts:28-36` selects Neon HTTP (drizzle `neon-http`) for CF Workers; that driver has no interactive transactions or `FOR UPDATE`, so `db.batch()` cannot lock. The dashboard/tenant clients generate a UUID on form open; double-click or retry resends the same key, and the second insert self-rejects via a partial unique index on `(lease_id, idempotency_key)`. The node-postgres path additionally locks + revalidates.

**Alternatives:** Row locks only (rejected: leaves the production Neon path racy); a unique index on `(utility_id) WHERE type='utility' AND amount>0` for utility settlement (rejected for now: collides with void-then-repay, which legitimately creates a second positive row after a negative reversal).

**Tradeoff:** Requires migration `0022` and clients must supply a stable key. Clients that never send a key fall back to a server-generated per-request UUID, preserving old behavior but not closing the race for legacy callers.

**Model:** GPT-5.6 Sol.

## 2026-09-03 - period-aware rent deferred

**Decision:** Defer the period-aware rent due model (lifetime `rent + credits − paid` misreads month-two rent as paid) to a separate `feat/period-aware-rent` branch.

**Why:** It is explicitly labelled future work (`credit.helpers.ts:48`, `TODO.md:244`) and requires a period-key migration plus migration of every reader (payments, overdue, reminders, portal, export). It is a design change, not a bugfix, and belongs in its own slice with its own rollback.

**Alternatives:** Include here (rejected: mixes a schema redesign into a bugfix branch, violating the one-migration-one-slice constraint).

**Model:** GPT-5.6 Sol.

## 2026-09-02 - active lease exclusivity

**Decision:** Enforce one active lease per unit with a partial unique index on `leases.unit_id WHERE status = 'active'`, preceded by a migration-time duplicate-data preflight.

**Why:** Application availability checks cannot prevent two concurrent requests from both observing an available unit. PostgreSQL must enforce this lifecycle invariant; the partial condition preserves valid historical expired and terminated leases.

**Alternatives:** A full unique index on `unit_id` (rejected: forbids legitimate lease history); a trigger (rejected: more complex and less transparent for a single immutable predicate); rely on the conditional unit-status update (rejected: it does not reject an already-inserted concurrent active lease).

**Tradeoff:** A production migration will stop if old duplicate active rows exist, requiring explicit data repair before the constraint can take effect. This is preferable to silently selecting or deleting a historical lease.

**Model:** GPT-5.6 Terra.

## 2026-09-02 - invite fixture isolation for provisional tenants

**Decision:** Make the invite integration teardown remove tenant profiles and users derived from each created invitation before deleting the invitation, and assert that an owner-prepared invitation creates its existing provisional user.

**Why:** Owner-prepared onboarding intentionally creates a provisional `user` and `tenant_profiles` row immediately. The stale test expectation and incomplete cleanup caused a foreign-key failure that leaked fixtures into later cases, obscuring agreement-wrapper verification.

**Alternatives:** Track the provisional user separately in every individual test (rejected: easy to omit and already missed in multiple tests); relax or remove the foreign key (rejected: would hide a genuine lifecycle dependency).

**Tradeoff:** Teardown treats every created invite ID as a possible provisional user ID, which is safe for isolated test UUIDs and keeps the fixture model aligned with production behavior.

**Model:** GPT-5.6 Terra.

## 2026-09-02 - agreement/payment-group expand migration

**Decision:** Add the physical agreement/payment-group schema and backfill every legacy lease/payment into a one-to-one independent parent. Reuse each legacy child UUID as its backfilled parent UUID, copy shared/transfer metadata without rewriting existing values, and populate only the new nullable foreign-key columns. Keep active-lease exclusivity and all payment-group writers in later slices.

**Why:** One parent per existing child is the only history-preserving interpretation available before combined agreements and grouped transfers existed. Reusing the child UUID is deterministic, requires no PostgreSQL UUID extension, and makes the migration auditable. Nullable columns retain expand-stage compatibility for writers deployed before the contract phase.

**Alternatives:** Generate random parent UUIDs in SQL (rejected: extension/runtime dependency and weaker traceability); leave historical rows ungrouped (rejected: blocks migrated reads and postpones an unambiguous backfill); combine the exclusivity index with this migration (rejected: it is a separate failure mode and rollback slice).

**Tradeoff:** Backfilled one-to-one parents share an identifier with their historical child in a different table. IDs remain table-scoped, but operators must use the entity/table name when discussing them.

**Model:** GPT-5.6 Sol.

## 2026-09-02 - multi-unit agreement foundation

**Decision:** Model a universal `lease_agreements` parent with unit-level `leases`; introduce `payment_groups` as the transfer parent of existing payment allocations. Use an expand-contract transition, keeping the new child foreign keys nullable until legacy writers and historical backfills are complete.

**Why:** Existing lease and payment API routes, receipts, exports, and test fixtures write/read single-unit records. Requiring the new foreign keys before those writers create parents would break live compatibility. Agreement category is derived from the unit type on the server: `shop` is commercial; current studio/BHK types are residential.

**Alternatives:** Add nullable grouping without a parent (rejected: ambiguous accounting); create separate room/shop lease types (rejected: duplicates accounting and tenancy logic); make new FKs non-null in the first migration (rejected: current writers cannot supply them).

**Tradeoff:** Temporary duplication of shared agreement/transfer facts remains while read and write paths transition. It costs an additional contract migration later but avoids unsafe deployment and preserves history.

**Model:** GPT-5.6 Terra.

## 2026-09-02 - agreement-wrapper verification coverage

**Decision:** Cover the compatibility wrapper through the existing invite integration suite, with one registered commercial-shop tenant and one owner-prepared residential tenant.

**Why:** Those are the two route branches with different atomic write order. Querying `lease_agreements` by tenant/property proves both that exactly one independent agreement exists and that the legacy lease response retains its parent link. The two unit types also exercise server-derived commercial/residential category assignment.

**Tradeoff:** The test is intentionally integration-level and requires `rently_test` plus the deferred physical migration; it is more valuable than a mock-only batch-order test but cannot execute in the current unavailable local database environment.

**Model:** GPT-5.6 Terra.

## 2026-08-25 - occasional-discounts - Decision: full GST-safe discount before launch (supersedes draft-only) — shipped 8d32713

**Why:** `TODO.md:194` and `b6c7f5e` (main after beta2 merge) require rent+utility coverage with GST configurability, soft launch owner-only (no external customers). Keeping `utilities.totalAmount` immutable and adding separate `bill_credits` (`0016_gst_and_bill_credits.sql`) preserves GST immutability per `research/gst-occasional-discounts.md` s.15(3)(a)/34. Residential rent 0% exempt default prevents over-charging.

**Alternatives:** Draft-only discount on utilities (kept as Step 1 slice). Hardcode 18% rent GST.

**Tradeoff:** Larger surface: needs `bill_credits`, derived `amountDue`, Settings GST gate, credit-note numbering `KQ-CN-xxx`.

**Evidence:** `TODO.md:194`, `docs/research/gst-occasional-discounts.md`, `TODO.md:213` spec, `ea33b66..8d32713` 28 files. Reasoned with Muse Spark 1.2.

## 2026-08-25 - occasional-discounts S5/S6 + soft-launch merge — Decision: merge feat/utility-discounts → main (not beta2)

**Why:** Branch was cut from `main` at `b6c7f5e` after `beta2→main` merge; no real customers, owner self-tests soft launch. All slices `S1` DB, `S2` settings API, `S3` credit API, `S4` payment `amountDue`, `S5` bill UI, `S6` credit-note PDF + `tax-gst-tab` + `discount-dialog` + `updateUtility` guard are done and `check-types` green. Keeps `main` as soft-launch truth; `beta2` will be re-cut from `main` later.

**Alternatives:** `feat→beta2→main` (avoids main churn but adds stale `beta2` indirection; rejected — extra merge, no customers to protect).

**Tradeoff:** `main` now contains GST-credit schema; rollback `ea33b66` restores pre-feature DB if needed. `docs/` is gitignored (local handover only) — `TODO.md` is the merge-visible source of truth.

**Evidence:** `git merge-base b6c7f5e main`, `TODO.md:212-220` all `[x]`, `check-types` 6/6, `vitest` 16/16. Reasoned with Muse Spark 1.2.

## 2026-08-25 - occasional-discounts - Decision: phase the feature as draft discount first (superseded)

**Why:** It provides owner-controlled, one-off discounts while preserving a clean GST invoice and receipt trail. The current utility-payment flow requires payment to match the bill total, so a discount must be part of the bill snapshot before payment.

**Alternatives:** Support refunds, next-cycle credits, and post-issue credit notes in the first release.

**Tradeoff:** Owners cannot yet use the new action to adjust an issued or paid bill; that workflow remains a later, separately auditable financial feature.

**Evidence:** GST research is recorded in [`research/gst-occasional-discounts.md`](./research/gst-occasional-discounts.md). Reasoned with Codex GPT-5.6 Terra.

## 2026-08-26 - beta-audit — Decision: fix audit via `fix/beta-bugfix-audit-2026-08-26` ship-loop, github-centric, R2 excluded + Aadhaar in-scope

**Why:** Audit 2026-08-26 found 6 P0 regressions `lease.ts:255` dead update + `payment.ts:139` unconditional `isPaid` + `credit.helpers.ts:8` missing payments + `credit.ts:128` no reversal row + `tenant-portal.ts:372` race + `email/src/index.ts:385` XSS + GST/soft-delete/scheduled leaks; all block beta gate `TODO.md:19-20`. Owner constraint: github-centric delivery, no manual `wrangler` bucket `cors set`/`deploy`, R2 operational checks are separate infra ticket, but `AADHAAR_UPLOADS_ENABLED=false` code paths must be proven (`tenant-document.ts:89`). Branch isolates 10 slices with explicit rollback `b2ed822` so `main` stays shippable.

**Alternatives:** A) Single mega-commit fixing all C/H — rejected (unreviewable, no bisect, violates ship-loop tier). B) Include R2 CORS `wrangler` push in same branch — rejected (owner asked separate, github-centric). C) Do Aadhaar backend + R2 CORS smoke together — rejected, R2 already has `cors.json:1` correct shape but needs infra-deployed verification outside this code PR.

**Tradeoff:** 10 small PR-able slices = more commits, slower merge, but each slices verify `check-types`/`vitest rently_test`/`build` independently and `TODO.md:19` R2 stays open until infra ticket (beta smoke must still pass `AADHAAR_UPLOAD_DISABLED` negative path).

**Evidence:** `docs/Bug-2026-08-26-beta-audit.md` Found/Repro/Plan table, `docs/Constraints.md` github-centric update, `apps/server/wrangler.json:23` `AADHAAR_UPLOADS_ENABLED=false`, `TODO.md:19-20,127-128`.

## 2026-08-25 - account-linking-security - Decision: skip TOTP 2FA, ship Google linking + sessions polish

**Why:** `TODO.md:253` TOTP placeholder evaluated on `feat/account-linking-security @ 7d8a1b9`; Indian owner segment low tech-savvy, password+Google 1-tap + `requireEmailVerification:true` covers beta. TOTP adds QR/backup-code support burden and low adoption. `packages/auth/src/index.ts:93` already has `google`+`github`+`accountLinking.enabled:true` via `account` table `packages/db/src/schema/auth.ts:77` — no migration needed. Sessions via `session` table (`ipAddress`, `userAgent`) already stored, just needed UI for `/list-sessions` + `/revoke-session`.

**Alternatives:** A) TOTP now (1 table `twoFactor`, QR, backupCodes), B) Passkey `@better-auth/passkey` (phishing-resistant but device/recovery friction + `passkey` table), C) Both. Rejected — complexity > beta value. Instagram as auth rejected (no email, Meta review); keep as profile handle only.

**Tradeoff:** No second factor if password leaks; mitigated by Google's own 2FA + email verification + `setPassword` fallback for OAuth-only users. Revisit 2FA/passkey after 20+ paying owners request it (logged in `TODO.md` Deferred).

**Evidence:** `docs/Feature-2FA-deferred.md`, `docs/Feature-account-linking.md`, `apps/dashboard/src/components/features/settings/security-tab.tsx:38` new Connected Accounts + Set Password + Sessions list, `check-types` 6/6, `build` 5/5. Reasoned with Muse Spark 1.2.
