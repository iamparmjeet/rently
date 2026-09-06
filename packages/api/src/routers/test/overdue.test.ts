// C08 overdue-state tests. Per the AGENTS.md test rule, each case pins a
// regression the period-ledger cutover must prevent:
// - overdue is a property of stored CHARGES (due date passed + outstanding
//   paise), never of the lifetime one-month heuristic;
// - a paid charge must not surface, but a charge reopened by a reversal must
//   (the void-then-repay regression);
// - the earliest overdue charge anchors dueDate/daysOverdue while arrears
//   aggregate into outstandingAmount — historical arrears stay visible
//   without inventing per-period noise (R13);
// - the R3 pre-start guard holds on snapshotted due dates: a first-period
//   charge whose due date precedes the lease start is not overdue;
// - paidTowardOverdue reports what settled those periods, not contract rent.
import { describe, expect, it } from "vitest";
import { computeLeaseOverdue, type OverdueCharge } from "../helpers/overdue";

const charge = (overrides: Partial<OverdueCharge> = {}): OverdueCharge => ({
	periodKey: "2026-08",
	dueDate: "2026-08-10",
	amount: 100_000,
	outstanding: 100_000,
	...overrides,
});

describe("computeLeaseOverdue", () => {
	it("does not mark a lease overdue while the charge's due date is ahead", () => {
		expect(
			computeLeaseOverdue(
				[charge()],
				new Date("2026-08-01T00:00:00.000Z"),
				"2026-08-10",
			),
		).toBeNull();
		expect(
			computeLeaseOverdue(
				[charge()],
				new Date("2026-08-01T00:00:00.000Z"),
				"2026-08-09",
			),
		).toBeNull();
	});

	it("marks an outstanding charge overdue the day after its due date", () => {
		expect(
			computeLeaseOverdue(
				[charge()],
				new Date("2026-08-01T00:00:00.000Z"),
				"2026-08-12",
			),
		).toMatchObject({
			periodKey: "2026-08",
			dueDate: "2026-08-10",
			daysOverdue: 2,
			outstandingAmount: 100_000,
		});
	});

	it("skips a settled charge and reports a reopened one after a reversal", () => {
		const settled = charge({ outstanding: 0 });
		const reopened = charge({ periodKey: "2026-09", dueDate: "2026-09-10" });
		expect(
			computeLeaseOverdue(
				[settled, reopened],
				new Date("2026-08-01T00:00:00.000Z"),
				"2026-09-12",
			),
		).toMatchObject({
			periodKey: "2026-09",
			dueDate: "2026-09-10",
			outstandingAmount: 100_000,
		});
	});

	it("aggregates arrears onto the earliest overdue charge's anchor", () => {
		const july = charge({ periodKey: "2026-07", dueDate: "2026-07-10" });
		const august = charge();
		const state = computeLeaseOverdue(
			[august, july],
			new Date("2026-07-01T00:00:00.000Z"),
			"2026-08-13",
		);
		expect(state).toMatchObject({
			periodKey: "2026-07",
			dueDate: "2026-07-10",
			daysOverdue: 34,
			outstandingAmount: 200_000,
		});
	});

	it("reports the paise already settled toward the overdue periods", () => {
		const partial = charge({ amount: 100_000, outstanding: 60_000 });
		expect(
			computeLeaseOverdue(
				[partial],
				new Date("2026-08-01T00:00:00.000Z"),
				"2026-08-13",
			),
		).toMatchObject({ paidAmount: 40_000, outstandingAmount: 60_000 });
	});

	it("applies the R3 pre-start guard to snapshotted due dates", () => {
		// Lease starts on the 15th; the first period's charge is due on the 5th.
		const first = charge({ periodKey: "2026-08", dueDate: "2026-08-05" });
		expect(
			computeLeaseOverdue(
				[first],
				new Date("2026-08-15T00:00:00.000Z"),
				"2026-08-20",
			),
		).toBeNull();
	});

	it("ignores a due date today but includes yesterday's", () => {
		const today = charge({ dueDate: "2026-08-13" });
		const yesterday = charge({ periodKey: "2026-08", dueDate: "2026-08-12" });
		expect(
			computeLeaseOverdue(
				[today],
				new Date("2026-08-01T00:00:00.000Z"),
				"2026-08-13",
			),
		).toBeNull();
		expect(
			computeLeaseOverdue(
				[yesterday],
				new Date("2026-08-01T00:00:00.000Z"),
				"2026-08-13",
			),
		).not.toBeNull();
	});
});
