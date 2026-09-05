# Rent-Period Business Rules (C01) — APPROVED by owner 2026-09-06

> Slice: C01 of `docs/Fix-Plan-2026-09-05.md`. This document is the contract
> that C02 (rent-period schema), C03 (backfill), C04 (dual-write), C05–C08
> (read model + cutover) implement against. Rules marked **[CURRENT]** are
> extracted from shipped code and simply recorded. Rules marked
> **[APPROVED]** were product decisions taken by the owner on 2026-09-06.
> Tests: none (worked examples only, per plan).

## R1 — Timezone **[CURRENT]**

All business dates (period keys, due dates, overdue day counts, reminder day
counts) are calendar dates in **Asia/Kolkata** (`RENT_TIME_ZONE`,
`rent-cycle.ts:6`). Timestamps in the database (payment_date, reading dates,
lease start/end) stay UTC instants; only their IST calendar interpretation is
authoritative for period logic.

- Worked example: a payment received at 2026-09-30T20:00:00Z (01:30 IST Oct 1)
  belongs to **October** for period attribution.
- G01 will migrate the remaining UI/UTC-default date handling to this rule;
  it does not change the rule.

## R2 — Period key **[APPROVED: calendar month, kept]**

A rent period is the calendar month in IST, keyed `YYYY-MM`
(`getLocalPeriodKey`). Not a billing anniversary: a lease starting on the 17th
still has its first period = the calendar month containing the 17th.

- Worked example: lease starts 2026-03-17 → periods 2026-03, 2026-04, …
- Worked example (India boundary): an event at 2026-03-31T19:00Z (00:30 IST
  Apr 1) falls in period 2026-04.

## R3 — Due day and clamping **[CURRENT]**

`leases.rent_due_date` (1–31, B02-validated). The due date of period `P` is
`min(dueDay, daysInMonth(P))` — clamped to the month's last day, **no
carry-over** into the next month (`getDueDateKey`).

- Day 29/30/31 examples: dueDay=31 → Jan 31, Feb 28 (29 in leap years),
  Apr 30. dueDay=29 in Feb 2027 → Feb 28; in Feb 2028 (leap) → Feb 29.
- A lease without an explicit due day falls back to the start date's day
  (current overdue behavior, `overdue.ts:37`); C02 should require it for new
  leases.
- Worked example (lease starting after this month's due date): lease starts
  2026-03-20, dueDay=5 → no March due date exists for this lease; first due
  date is 2026-04-05 (current overdue skip, `overdue.ts:53`, generalized to
  all periods).

## R4 — First-period charge: PRORATED **[APPROVED]**

A period in which the lease starts mid-month charges **only the days stayed**.

- Formula: `charge = round_half_up(rent × activeDays ÷ daysInMonth)` (paise);
  `activeDays` counts the lease-active days in that period, inclusive of both
  start day and (where applicable) end day.
- Worked examples (rent ₹15,000 = 1,500,000 paise):
  - Start 2026-01-17 (Jan has 31 days) → 15 days →
    1,500,000 × 15/31 = 725,806 paise = **₹7,258.06**.
  - Start 2026-03-01 → full month → **₹15,000.00**.
- C03 consequence: historical leases' first periods are prorated
  deterministically from `startDate`; leases with missing/ambiguous dates go
  to the exception report, never silently invented.

## R5 — Last-period charge: PRORATED **[APPROVED]**

Symmetric with R4: a period in which the lease ends mid-month charges only the
days stayed (inclusive of the last day). No charge for a period that begins
after `endDate`. Reminders already stop after endDate (`rent-cycle.ts:122`).

- Worked example: lease ends 2026-09-15 (Sep has 30 days) → 15 days →
  **₹7,500.00**; no 2026-10 charge.
- Worked example: ends 2026-02-20 in leap year 2028 (29 days) → 9 days →
  1,500,000 × 9/29 = **₹5,172.41**.

## R6 — Advance payment: ALLOWED with a cap **[APPROVED]**

A payment may pre-pay future periods once all outstanding charges are cleared.
Bound for safety: prepay covers at most **1 future period** beyond the current
one (default cap; configurable later). An amount exceeding outstanding + the
prepay cap is rejected with a clear message — no unbounded advance is held.

- Worked example: all charges settled through 2026-09; tenant pays October's
  ₹15,000 on 2026-09-20 → creates/allocates the 2026-10 charge. A further
  ₹15,000 attempt in the same state is rejected (cap reached).

## R7 — Allocation priority: FIFO **[APPROVED, load-bearing]**

Every payment is allocated to outstanding period charges **oldest period
first**; a single charge may be partially allocated (see R8). With prepay,
after all existing charges are cleared the next amount creates and allocates
the next future period charge (R6 cap applies).

- Worked example: charges 2026-07 (₹15,000, 5,000 outstanding), 2026-08
  (₹15,000 outstanding); payment ₹25,000 → allocations 2026-07 ₹5,000 (now
  settled), 2026-08 ₹15,000, then ₹5,000 prepay into 2026-09.

## R8 — Partial payment: ALLOWED, arbitrary amounts **[APPROVED]**

The full-balance rule ("payment must equal the outstanding balance") is
REPLACED at the C04 dual-write stage: a rent payment accepts any positive
amount up to `total outstanding + prepay cap` and is allocated FIFO (R7).
Until cutover, the shipped commands keep the current invariant; the new
period-aware writers accept partial amounts behind the dual-write.

- Worked example: ₹15,000 due, tenant hands ₹10,000 → accepted; allocation
  ₹10,000 against the oldest outstanding charge; ₹5,000 remains due and the
  overdue machinery reports it normally.
- UI consequence (C06/C07): payment dialogs gain an editable amount with a
  server-computed maximum.

## R9 — Termination mid-period **[APPROVED as proposed]**

Charges accrue only through the period containing `endDate` (prorated per
R5). A terminated lease keeps its outstanding charges collectible — settling
them uses the existing single-lease payment flow (FIFO allocations). Overdue
notifications stop at termination, but the balance read model still shows
arrears.

- Worked example: lease terminated 2026-09-10 with September unpaid → the
  prorated September charge stays outstanding and collectible; no October
  charge.

## R10 — What Phase C replaces **[CURRENT — the known defect]**

Today's model is a **single lifetime charge**: outstanding =
`leases.rent + rentCredits − signedRentLedger` (`getAmountDueForRent`). Month
two of tenancy reads as already paid (month-one payment zeroes the balance) —
the defect documented in `credit.helpers.ts` and the reason Phase C exists.
C02 replaces this with per-period charges + allocations; the compatibility
fields (`leases.rent`, lifetime reads) stay until the C08 cutover.

- Worked example of the defect: rent ₹15,000, start 2026-01-01, payment
  2026-01-05 ₹15,000 → today 2026-02 outstanding reads ₹0; correct model:
  2026-02 charge ₹15,000 outstanding.

## R11 — Reactivation **[CURRENT, unchanged]**

Reactivation of a terminated lease is status-only (E06 will enforce strictly);
reactivating does not create, delete, or modify period charges. Charges exist
only for periods where the lease was active on some day; a terminated
stretch inside an active span is part of that span's periods (no gap-month
logic). Conflicting active lease on the unit still blocks reactivation.

- Worked example: active 2026-01→2026-03, terminated 2026-02-10, reactivated
  2026-02-20 → charges exist for 2026-01, 2026-02, 2026-03; February prorated
  only if the active span does not cover the whole month.

## R12 — Renewal: new lease row **[APPROVED]**

Renewal creates a new lease (new agreement wrapper, new `startDate`, own
period charges); it never extends or rewrites the old lease's dates. History
stays append-only and C03's backfill stays deterministic. A same-unit renewal
starts after the old lease's `endDate`; overlapping spans on one unit remain
blocked by the active-lease exclusivity index.

- Worked example: lease ends 2026-12-31, renewed → new lease starts 2027-01-01
  with its own 2027-01 charge; the old lease keeps its charges untouched.

## R13 — Backdated lease registration (arrears) **[APPROVED — the owner's scenario]**

When a lease is registered (or reactivated) with a `startDate` in the past,
charges are created for **every elapsed period since start** — first period
prorated (R4) — and all of them are outstanding from the moment of
registration. The owner then records whatever the tenant actually pays; FIFO
allocation (R7) settles the oldest arrears first, partial amounts are fine
(R8), and every settlement is atomic with a receipt showing the allocation
breakdown (B-series guarantees carry over). Nothing is lost and nothing is
invented: the charge amounts derive from the lease dates alone.

- Worked example (owner's case): today is 2026-09-06; the owner registers a
  lease that started 2026-07-01, rent ₹15,000, dueDay=5. Charges: 2026-07
  ₹15,000, 2026-08 ₹15,000, 2026-09 ₹15,000 — all outstanding. The tenant
  pays ₹35,000 "for the two pending months plus part of this month" →
  allocations 2026-07 ₹15,000, 2026-08 ₹15,000, 2026-09 ₹5,000. Outstanding
  ₹10,000 on 2026-09; overdue reporting treats it exactly like any other
  partially-paid period.
- C08 refinement flagged here: a freshly registered backdated lease must not
  blast a burst of overdue emails for periods elapsed before registration;
  arrears are visible in the balance read model regardless.

## R14 — Reminders and overdue under the period model **[CURRENT, generalized]**

The shipped reminder machinery (`rent-cycle.ts`, `overdue.ts`) already works
per period: RENT_DUE reminder `rentDueLeadDays` (default 3) before the period's
due date; OVERDUE notice `overdueGraceDays` (default 2) after it; nothing for
inactive leases or leases outside their start/end span. C08 cuts these readers
from the lifetime balance to per-period charges without changing the
day-threshold rules. A period is "paid" when its charge is fully allocated
(reversals included, B12 attribution). A period is overdue when its due date
has passed and any part of the charge is outstanding.

## Worked example — end-to-end (approved rules)

Lease: start 2026-01-17, rent ₹15,000, dueDay=5, no end date.
- Charges: 2026-01 ₹7,258.06 (R4), 2026-02 ₹15,000, 2026-03 ₹15,000 …
- Due dates: 2026-02-05, 2026-03-05, … (R3 clamping: dueDay=31 would give
  2026-02-28).
- 2026-02-01: tenant pays ₹10,000 (partial, R8) → allocation 2026-01 ₹7,258.06
  (cleared) + 2026-02 ₹2,741.94 (partial).
- 2026-02-02: RENT_DUE reminder for 2026-02 (due 2026-02-05) reflects the
  ₹12,258.06 still outstanding for February.
- 2026-02-07: OVERDUE notice (grace 2 days) while February remains partially
  unpaid.
- 2026-02-20: tenant pays ₹40,000 → allocations: 2026-02 remaining
  ₹12,258.06, 2026-03 ₹15,000 (now fully paid early = R6 prepay of one
  period), remaining ₹12,741.94 exceeds the prepay cap → rejected unless the
  amount is trimmed. (With the cap, the max accepted here is
  ₹27,258.06 + ₹15,000.)
- March: charge ₹15,000 appears on 2026-03-01; unpaid until settled.

## Status

- APPROVED 2026-09-06 — all decision points resolved by the owner: R2 calendar
  months; R4 prorated first period; R5 prorated last period; R6 prepay allowed
  with 1-period cap; R7 FIFO; R8 arbitrary partial; R9 accrual through endDate
  period, collectible; R12 new-lease renewal; R13 backdated arrears mechanism.
  C02 may now design against this document.
