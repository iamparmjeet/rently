import { describe, expect, it } from "vitest";
import { computeOverdueState, type OverdueCandidate } from "../helpers/overdue";

const baseRow = (
	overrides: Partial<OverdueCandidate> = {},
): OverdueCandidate => ({
	rent: 100_000,
	paidAmount: 0,
	startDate: new Date("2026-01-01T00:00:00.000Z"),
	endDate: null,
	rentDueDate: 10,
	leaseStatus: "active",
	...overrides,
});

describe("computeOverdueState", () => {
	it("does not mark a lease overdue before the due date", () => {
		expect(computeOverdueState(baseRow(), "2026-08-10")).toBeNull();
	});

	it("does not mark rent due today as overdue", () => {
		expect(computeOverdueState(baseRow(), "2026-08-10")).toBeNull();
	});

	it("marks an unpaid lease overdue after the due date", () => {
		expect(computeOverdueState(baseRow(), "2026-08-13")).toEqual({
			dueDate: "2026-08-10",
			daysOverdue: 3,
			paidAmount: 0,
			outstandingAmount: 100_000,
		});
	});

	it("reports the remaining amount for a partial payment", () => {
		expect(
			computeOverdueState(baseRow({ paidAmount: 40_000 }), "2026-08-13"),
		).toMatchObject({
			paidAmount: 40_000,
			outstandingAmount: 60_000,
		});
	});

	it("does not mark a fully paid lease overdue", () => {
		expect(
			computeOverdueState(baseRow({ paidAmount: 100_000 }), "2026-08-13"),
		).toBeNull();
	});

	it("ignores leases that start after the due date", () => {
		expect(
			computeOverdueState(
				baseRow({
					startDate: new Date("2026-08-15T00:00:00.000Z"),
				}),
				"2026-08-20",
			),
		).toBeNull();
	});

	it("ignores inactive leases and falls back to the lease start day", () => {
		expect(
			computeOverdueState(baseRow({ leaseStatus: "terminated" }), "2026-08-13"),
		).toBeNull();

		expect(
			computeOverdueState(
				baseRow({
					rentDueDate: null,
					startDate: new Date("2026-08-01T00:00:00.000Z"),
				}),
				"2026-08-13",
			),
		).toMatchObject({ dueDate: "2026-08-01", daysOverdue: 12 });
	});
});
