# Decisions

## 2026-09-06 - C04 rent-period dual-write

**Decision:** Every rent-affecting writer now also maintains the period ledger
while the lifetime model stays authoritative for reads. A shared helper emits
single-statement SQL so node transactions and Neon batches execute identical
logic: charge accrual (`ensureAccruedChargesSql`, wired into lease creation and
every settlement — R13 makes a backdated start owe elapsed periods
immediately), FIFO allocation of payments/credits into outstanding charges
(`allocateRent*Sql`, the C03 interval-overlap scoped per operation), reversal
mirrors (a reversal negates exactly its original's allocations), and a
remainder reporter listing paise a divergent history cannot absorb.
`createPayment` for rent relaxes its validation from "must equal the
outstanding balance" to "must not exceed it" (C01 R8 partial payments go live;
advances stay refused). Prepay (R6) is not activated yet — the old validation
still bounds amounts; it opens with the C05 read model.

**Why:** Dual-write keeps production behavior unchanged for existing flows
while every new operation lands in both ledgers, so the C05 read model can be
built and verified against data that reconciles by construction. The delta
invariant (each operation moves both ledgers by the same paise) holds for
clean leases in absolute terms; for backdated or pre-C04-divergent leases the
accrued history is the documented Phase-C gap.

**Alternatives:** Activating partial payments only at the C08 cutover
(rejected: C04's acceptance list requires partial-payment reconciliation);
prepay in C04 (deferred: needs the new read model to be meaningful); a
period-arrival job creating charges on month boundaries (deferred: lazy
accrual at operation time covers the dual-write phase, and C08 owns scheduled
work).

**Tradeoff:** Eleven existing API test suites needed period-ledger cleanup
(the RESTRICT foreign keys make incomplete teardown loud); the lifetime and
period ledgers diverge absolutely on pre-C04 histories by design — only
operation deltas reconcile until the C08 cutover; vitest now runs with
fileParallelism disabled because suites share one database and the period
tables are global state.

**Model:** ZLM 5.3 Flash (Luna scope); Terra review owed per plan.

## 2026-09-06 - C03 historical rent-period backfill

**Decision:** Backfill the period ledger with one idempotent, hand-authored
migration (0032). Charges: one per lease per period the lease was active,
through the current IST month for ongoing leases (never future periods),
prorated at tenancy edges, with the clamped due date snapshotted. Allocations:
historical positive rent payments and rent-scoped discount credits are poured
into charges oldest-period-first via a cumulative-interval overlap (a charge
occupies the paise range of the lease's charge total, a source the range of
the lease's flow total — the overlap is the allocation). Payment reversals and
credit reversals never enter the stream; they mirror their original's
allocations negated. Everything that does not fit deterministically is listed
in `rent_backfill_exceptions` (ambiguous accrual end for terminated/expired
leases without an end date; per-source unallocated remainders) instead of
being guessed. Date math uses the stored wall-clock date part.

**Why:** The lifetime model under-recorded reality (only one month's rent was
ever collectible per lease), so historical flows can legitimately overflow the
deterministic charge set — the seed data does, by design of the old model. The
interval-overlap formulation makes FIFO deterministic and expressible in one
SQL statement (Neon-safe), and the exceptions table gives the owner a
durable, queryable review artifact rather than a run-log nobody keeps.

**Alternatives:** TypeScript backfill script (rejected: the plan specifies a
backfill migration and deploy-time execution); allocating reversals as stream
sources (rejected: a reversal must undo exactly its original's allocations,
not re-flow chronologically); materializing outstanding on charges (rejected:
derived state drifts — C05 computes it); silently clamping overpayments
(rejected: that invents history).

**Tradeoff:** Charges assume each lease's current `rent` applied to its whole
history (rent edits were never modeled — documented limitation); the
seed/sample leases' arbitrary historical payment amounts surface as exception
rows the owner must acknowledge; "today" at migration time fixes the
ongoing-lease charge set (later periods accrue via C04 writers).

**Model:** ZLM 5.3 Flash (Luna scope); Sol review owed per plan.

## 2026-09-06 - C02 period rent charges and allocations schema

**Decision:** Represent monthly rent independently of lifetime totals with two
additive tables. `rent_charges` holds one row per lease per IST calendar month
(unique on `(lease_id, period_key)`) with the paise owed (full or prorated per
the C01 rules), a format-checked `YYYY-MM` period key, and the clamped due
date snapshotted per charge. `rent_allocations` links a charge to exactly one
source row — a `payments` row or a rent-scoped `bill_credits` row — with a
nonzero "settles the charge" paise amount: payment rows mirror their signed
amount (reversals arrive negative), credit rows invert their bill_credits
amount. One allocation per source row per charge (partial unique indexes); a
charge's outstanding is `amount − sum(allocations)`. Over-allocation stays a
writer-level invariant (B08/B10 lock-first recompute), deliberately not a
row-level CHECK. RESTRICT FKs keep settled history undeletable.

**Why:** C01 approved prorated edges, partial payments, FIFO allocation, a
one-period prepay cap, and backdated arrears — none representable in the
single-lifetime-charge model. The schema is write-free until C04 dual-writes,
so the additive migration carries zero risk to live writers, and snapshotting
the due date per charge keeps receipts truthful when `rentDueDate` changes
later.

**Alternatives:** Period columns on `payments` (rejected: a payment spans
multiple charges and a charge spans multiple payments — a join table is the
only faithful shape); enforcing allocation limits with a constraint trigger
(rejected: the B-series keeps balance math in transparent writers, and a
trigger would silently fire under Neon HTTP batch paths too); storing
outstanding materialized on the charge (rejected: derived state drifts —
compute it from allocations in the C05 read model).

**Tradeoff:** Until C04/C08, two rent ledgers coexist by design: charges stay
empty in production, readers keep using the lifetime calculation, and C03
must backfill deterministically (prorating edge periods from lease dates,
routing ambiguous history to an exception report) before any writer turns on.

**Model:** ZLM 5.3 Flash (Luna scope); Sol/Terra review owed per plan.

## 2026-09-06 - C01 rent-period business rules approved

**Decision:** Adopt `docs/Rent-Period-Rules.md` as the contract for Phase C.
Periods are IST calendar months keyed `YYYY-MM`; due dates clamp to the month's
last day with no carry-over. The first and last periods of a tenancy are
PRORATED by active days (`round_half_up(rent × activeDays ÷ daysInMonth)`).
Partial payments are accepted in arbitrary amounts and allocated
oldest-period-first (FIFO), with at most one future period prepayable beyond
outstanding. Backdated lease registration creates charges for every elapsed
period (first prorated) as immediately-outstanding arrears the owner settles
in any amounts via FIFO allocation. Termination stops accrual at the endDate
period but keeps arrears collectible; renewal is a new lease row, never a
date rewrite.

**Why:** The owner approved each point on 2026-09-06 after reviewing drafted
options against shipped behavior. Proration and partial payments match how
the owner actually collects rent (tenants moving mid-month, backdated
registrations with 1–2 months of pending rent paid alongside the current
month); the FIFO + capped-prepay mechanism keeps every paise allocated,
auditable, and bounded without inventing history.

**Alternatives:** Full-month charges at both edges (rejected: owner chose
days-stayed); keeping the full-balance-only settlement rule (rejected: it
cannot express the owner's backdated-arrears collections); unlimited prepay
(rejected: inflates advance-held reporting and complicates refunds — H04);
extending endDate for renewal (rejected: rewrites historical terms, conflicts
with E06 immutability).

**Tradeoff:** C02 must carry per-period charges plus per-allocation rows and a
prepay cap; C03 backfill must prorate historical first/last periods from lease
dates and route ambiguous dates to an exception report; C04 introduces the
first API contract change of the plan (partial amounts), staged behind the
dual-write; C08 must prevent a burst of overdue notices for periods elapsed
before a backdated registration.

**Model:** ZLM 5.3 Flash (drafted from shipped-code behavior); product
decisions and approval: Parmjeet Mishra (owner, 2026-09-06).

## 2026-09-06 - B11 atomic combined-bill command

**Decision:** Replace the dashboard's parallel per-leg combined-bill mutations
with one server command, `createCombinedBillPayment`, that settles a single
lease's outstanding rent plus named unpaid utilities into one payment group.
Every allocation is derived from committed balances inside settlement
protection (node-postgres: lease-then-utilities row locks; Neon HTTP: advisory
locks plus one conditional CTE statement). Any named utility with no
outstanding balance rejects the whole command. One grouped receipt is sent only
after commit. Replay and fingerprint reuse the B09 group-level idempotency
metadata on `payment_groups`; no schema change.

**Why:** The dialog previously fired `createPayment` plus one
`recordUtilityPayment` per bill through `Promise.all`, so a mid-flight failure
left earlier legs committed as a partial settlement outside any group, and
every leg emailed its own receipt. The payment group is the atomicity and
idempotency unit the ledger already has, and B10 established the
lock-first/recompute-inside pattern this command reuses.

**Alternatives:** Per-leg compensation on failure (rejected: deleting or
rewriting committed financial rows violates ledger immutability);
client-orchestrated transactions (rejected: browsers cannot hold database
transactions); extending `createAgreementPayment` to utilities (rejected: it
spans a whole combined agreement and requires every unit positive, while the
combined bill is per lease with optional rent).

**Tradeoff:** A named utility with zero outstanding due fails the command
loudly instead of being skipped — a race with a concurrent individual payment
surfaces as an error and the owner retries after refreshing (same policy as
B10's grouped rent). Rent is optional: a combined bill whose rent is already
settled records only the utility legs. Both drivers share the lock order
(lease first, then utilities by id) so combined and individual settlements
serialize identically on either path.

**Model:** ZLM 5.3 Flash (Luna backend + Muse UI scopes; Terra High design
gate deferred by owner until after implementation).

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

## 2026-09-05 - canonical signed-ledger read model

**Decision:** All reversal-aware payment readers use one signed-ledger helper.
Each row keeps its stored signed amount and display type, while a reversal gets
an internal category from its linked original payment. The B03
`reversesPaymentId` link is authoritative; the retained `referenceNumber` is a
fallback only for legacy rows whose nullable link is absent.

**Why:** Filtering every reader on the stored `reversal` type either drops a
legitimate reversal from net totals or attributes it to the wrong balance. A
single read model makes rent, utility, reminder, revenue, recent-payment, and
receipt paths agree without rewriting historical rows.

**Alternatives:** Treat every reversal as rent (rejected: deposit, utility, and
other reversals must not affect rent); infer category from `utilityId` alone
(rejected: it cannot distinguish rent, deposit, and other non-utility rows);
introduce period-keyed rent charges (deferred to Phase C).

**Tradeoff:** Readers perform a linked-original lookup and ignore an
unattributed reversal for category-specific calculations. Raw reversal rows
remain visible where the existing API exposes the ledger.

**Model:** GPT-5.6 Luna.

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
