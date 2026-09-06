// C07 bill-line builder tests. Per the AGENTS.md test rule, each case pins a
// Fix-Plan C07 acceptance state and the regression it prevents — these are
// exactly the states the old "full contract rent + this month's utilities"
// bill got wrong:
// - paid rent: a settled period must produce no rent line (the defect: the
//   tenant saw the full contract rent as due every month);
// - partial rent: the line shows the outstanding remainder, not the rent;
// - credit: a discount reduces the rent line through the read model;
// - reversal: a voided payment reopens the charge, so the line reappears;
// - two active units: each unit gets its own rent lines with its own state;
// - older unpaid utility: an unpaid bill from a previous month must still
//   appear (the old current-calendar-month filter hid it);
// - current/older split: arrears show as their own "previous periods" line;
// - due date: the server's clamped current-period due date wins over the old
//   1st-of-next-month guess.
import { describe, expect, it } from "vitest";
import {
	balanceByLeaseId,
	buildRentLines,
	buildUtilityLines,
	currentDueDate,
	periodLabel,
	summarizeLines,
	type TenantBalanceSlice,
	type TenantUtilitySlice,
} from "./bill-lines";

const unitA = {
	leaseId: "lease-a",
	unitNumber: "U-101",
	status: "active",
	propertyName: "Sunshine Apartments",
};
const unitB = { ...unitA, leaseId: "lease-b", unitNumber: "U-102" };

function balance(
	overrides: Partial<TenantBalanceSlice> = {},
): TenantBalanceSlice {
	return {
		leaseId: "lease-a",
		currentRentDue: 150_000,
		totalRentDue: 150_000,
		currentPeriodKey: "2026-09",
		currentPeriodDueDate: "2026-09-05",
		...overrides,
	};
}

function utility(
	overrides: Partial<TenantUtilitySlice> = {},
): TenantUtilitySlice {
	return {
		id: "util-1",
		leaseId: "lease-a",
		utilityType: "electricity",
		amountDue: 10_000,
		currentReadingDate: "2026-09-01",
		createdAt: "2026-09-01",
		...overrides,
	};
}

describe("buildRentLines", () => {
	it("produces no rent line for a fully paid period", () => {
		const lines = buildRentLines(
			[unitA],
			balanceByLeaseId([balance({ totalRentDue: 0, currentRentDue: 0 })]),
		);
		expect(lines).toEqual([]);
	});

	it("shows the outstanding remainder after a partial payment", () => {
		const lines = buildRentLines(
			[unitA],
			balanceByLeaseId([
				balance({ totalRentDue: 100_000, currentRentDue: 100_000 }),
			]),
		);
		expect(lines).toHaveLength(1);
		expect(lines[0]?.amount).toBe(100_000);
		expect(lines[0]?.label).toBe("Rent — September 2026");
	});

	it("reflects a credit through the reduced outstanding and a reversal through the restored one", () => {
		// A discount and a voided payment are both represented by the read
		// model's outstanding paise — the builder only renders what it says.
		const credited = balance({
			totalRentDue: 100_000,
			currentRentDue: 100_000,
		});
		const reversed = balance({
			totalRentDue: 150_000,
			currentRentDue: 150_000,
		});
		expect(
			buildRentLines([unitA], balanceByLeaseId([credited]))[0]?.amount,
		).toBe(100_000);
		expect(
			buildRentLines([unitA], balanceByLeaseId([reversed]))[0]?.amount,
		).toBe(150_000);
	});

	it("keeps current and older outstanding charges as separate lines", () => {
		const lines = buildRentLines(
			[unitA],
			balanceByLeaseId([
				balance({ totalRentDue: 300_000, currentRentDue: 150_000 }),
			]),
		);
		expect(lines).toHaveLength(2);
		expect(lines[0]?.label).toBe("Rent — September 2026");
		expect(lines[0]?.amount).toBe(150_000);
		expect(lines[1]?.label).toBe("Rent — previous periods");
		expect(lines[1]?.amount).toBe(150_000);
	});

	it("gives each unit of a multi-unit tenancy its own lines", () => {
		const lines = buildRentLines(
			[unitA, unitB],
			balanceByLeaseId([
				balance({ leaseId: "lease-a", totalRentDue: 0, currentRentDue: 0 }),
				balance({ leaseId: "lease-b" }),
			]),
		);
		expect(lines).toHaveLength(1);
		expect(lines[0]?.sub).toContain("U-102");
	});
});

describe("buildUtilityLines", () => {
	it("includes an older unpaid utility the old month filter would have hidden", () => {
		const olderBill = utility({
			id: "util-old",
			currentReadingDate: "2026-07-20",
			amountDue: 25_000,
		});
		const lines = buildUtilityLines(
			[unitA],
			[olderBill, utility({ id: "util-current" })],
		);
		expect(lines.map((line) => line.id)).toEqual(["util-old", "util-current"]);
		expect(summarizeLines(lines)).toBe(35_000);
	});

	it("skips settled utilities and bills on inactive units", () => {
		const lines = buildUtilityLines(
			[unitA],
			[
				utility({ amountDue: 0 }),
				utility({ id: "util-b", leaseId: "lease-b" }),
			],
		);
		expect(lines).toEqual([]);
	});
});

describe("currentDueDate / periodLabel", () => {
	it("uses the server's clamped due date and formats the period key", () => {
		const byLease = balanceByLeaseId([
			balance({ leaseId: "lease-a", currentPeriodDueDate: null }),
			balance({ leaseId: "lease-b", currentPeriodDueDate: "2026-02-28" }),
		]);
		expect(currentDueDate([unitA, unitB], byLease)).toBe("2026-02-28");
		expect(currentDueDate([unitA], balanceByLeaseId([]))).toBeNull();
		expect(periodLabel("2026-02")).toBe("February 2026");
	});
});
