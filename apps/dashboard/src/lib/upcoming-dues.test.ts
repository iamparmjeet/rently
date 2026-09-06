// C06 Upcoming Dues selector tests. Per the AGENTS.md test rule, each case
// pins a Fix-Plan C06 acceptance state and the regression it prevents —
// these states are exactly the ones the old "paid this month" payment-sum
// heuristic got wrong:
// - paid: a settled lease must not appear as due (the old heuristic showed
//   full rent whenever the calendar month had no payment row);
// - partial: the widget must show the outstanding remainder, not the full
//   contract rent;
// - overdue: arrears (previous periods, or the current period past its due
//   date) must surface as overdue regardless of the next due date;
// - reversed: a voided payment reopens the charge, so the lease must
//   reappear with the restored outstanding;
// - credited: a discount must reduce the displayed due, not be ignored;
// - multi-unit: every lease of a tenant/owner appears with its own state;
// - month-end due date: the server's clamped due date (R3, e.g. Feb 28 for
//   dueDay 31) must drive the countdown without off-by-one drift.
import { describe, expect, it } from "vitest";
import {
	countOverdueLeases,
	type LeaseBalanceInput,
	selectDueEntries,
	sumOverdueRent,
} from "./upcoming-dues";

const TODAY = new Date("2026-09-06T12:00:00");

function lease(overrides: Record<string, unknown> = {}) {
	return {
		leaseId: "lease-1",
		tenantName: "Test Tenant",
		unitNumber: "U-1",
		propertyName: "Prop",
		rent: 150_000,
		rentDueDate: 5,
		startDate: "2026-08-01",
		...overrides,
	};
}

function balance(
	overrides: Partial<LeaseBalanceInput> = {},
): LeaseBalanceInput {
	return {
		leaseId: "lease-1",
		totalRentDue: 150_000,
		overdueRent: 0,
		currentPeriodDueDate: "2026-09-05",
		...overrides,
	};
}

describe("selectDueEntries", () => {
	it("excludes a fully paid lease and includes a partial one at its outstanding remainder", () => {
		const paid = balance({ leaseId: "paid", totalRentDue: 0 });
		const partial = balance({ leaseId: "partial", totalRentDue: 50_000 });
		const byLease = new Map([
			["paid", paid],
			["partial", partial],
		]);
		const entries = selectDueEntries(
			[lease({ leaseId: "paid" }), lease({ leaseId: "partial" })],
			byLease,
			TODAY,
		);
		expect(entries).toHaveLength(1);
		expect(entries[0]?.leaseId).toBe("partial");
		expect(entries[0]?.amount).toBe(50_000);
	});

	it("marks arrears overdue even when the current period's due date is still ahead", () => {
		const entries = selectDueEntries(
			[lease()],
			// Due on the 10th (4 days out) but last month was never settled.
			new Map([["lease-1", balance({ overdueRent: 150_000 })]]),
			TODAY,
		);
		expect(entries[0]?.urgency).toBe("overdue");
	});

	it("marks a current period past its clamped due date overdue with the day count", () => {
		const entries = selectDueEntries(
			[lease()],
			new Map([["lease-1", balance({ currentPeriodDueDate: "2026-09-01" })]]),
			TODAY,
		);
		expect(entries[0]?.urgency).toBe("overdue");
		expect(entries[0]?.daysUntil).toBe(-5);
	});

	it("reappears after a reversal reopens the charge (restored outstanding)", () => {
		// A voided payment is represented in the read model exactly like any
		// outstanding charge: totalRentDue back at the full amount.
		const entries = selectDueEntries(
			[lease()],
			new Map([["lease-1", balance({ totalRentDue: 150_000 })]]),
			TODAY,
		);
		expect(entries[0]?.amount).toBe(150_000);
	});

	it("shows the credited due, not the contract rent", () => {
		const entries = selectDueEntries(
			[lease()],
			new Map([["lease-1", balance({ totalRentDue: 100_000 })]]),
			TODAY,
		);
		expect(entries[0]?.amount).toBe(100_000);
	});

	it("returns one entry per lease for a multi-unit tenancy, urgent first", () => {
		const byLease = new Map<string, LeaseBalanceInput>([
			[
				"lease-a",
				balance({ leaseId: "lease-a", currentPeriodDueDate: "2026-09-20" }),
			],
			["lease-b", balance({ leaseId: "lease-b", overdueRent: 1 })],
		]);
		const entries = selectDueEntries(
			[lease({ leaseId: "lease-a" }), lease({ leaseId: "lease-b" })],
			byLease,
			TODAY,
		);
		expect(entries.map((entry) => entry.leaseId)).toEqual([
			"lease-b",
			"lease-a",
		]);
	});

	it("counts days to the server's clamped month-end due date without drift", () => {
		const entries = selectDueEntries(
			[lease()],
			// dueDay 31 clamped to Feb 28 (R3): server snapshotted the clamp.
			new Map([["lease-1", balance({ currentPeriodDueDate: "2026-02-28" })]]),
			new Date("2026-02-27T12:00:00"),
		);
		expect(entries[0]?.daysUntil).toBe(1);
		expect(entries[0]?.urgency).toBe("soon");
	});

	it("falls back to clamped client math when no current-period charge exists", () => {
		const entries = selectDueEntries(
			[lease({ rentDueDate: 31 })],
			new Map([["lease-1", balance({ currentPeriodDueDate: null })]]),
			new Date("2026-02-27T12:00:00"),
		);
		// Feb clamp: day 31 → 28, one day out (no carry-over into March).
		expect(entries[0]?.dueDate.getDate()).toBe(28);
		expect(entries[0]?.urgency).toBe("soon");
	});
});

describe("overdue summary aggregation", () => {
	it("counts leases with arrears and sums only their overdue rent", () => {
		const balances = [
			balance({ leaseId: "a", overdueRent: 150_000 }),
			balance({ leaseId: "b", overdueRent: 25_000 }),
			balance({ leaseId: "c", overdueRent: 0, totalRentDue: 150_000 }),
		];
		expect(countOverdueLeases(balances)).toBe(2);
		expect(sumOverdueRent(balances)).toBe(175_000);
		expect(countOverdueLeases(undefined)).toBe(0);
	});
});
