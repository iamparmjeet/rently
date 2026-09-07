// H02 utility overdue summaries — regression rationale:
// Summaries summed gross totals and trusted the stale isPaid flag, so a
// discounted bill read full, a partial settlement counted as fully paid, a
// reversed payment still read settled, and an over-credit drove dues
// negative. Every summary below derives from the server amountDue instead:
// settled means due <= 0, outstanding clamps at zero, and collected is the
// paid portion (total + credits − due), never the gross of settled rows.
import { describe, expect, it } from "vitest";
import {
	isUtilitySettled,
	summarizeUtilities,
	utilityCollected,
	utilityOutstanding,
} from "./utility-summary";

const BILL = {
	totalAmount: 55000,
	credits: [] as Array<{ amount: number }>,
};

describe("utility summaries", () => {
	it("reads a discounted bill at its net due", () => {
		const bill = {
			...BILL,
			amountDue: 50000,
			credits: [{ amount: -5000 }],
		};

		expect(isUtilitySettled(bill)).toBe(false);
		expect(utilityOutstanding(bill)).toBe(50000);
		expect(utilityCollected(bill)).toBe(0);
	});

	it("counts a partial settlement as its paid portion only", () => {
		const bill = { ...BILL, amountDue: 35000 };

		expect(isUtilitySettled(bill)).toBe(false);
		const summary = summarizeUtilities([bill]);
		expect(summary.totalOutstanding).toBe(35000);
		expect(summary.totalCollected).toBe(20000);
		expect(summary.settledRecords).toBe(0);
	});

	it("reopens the due when a payment is reversed", () => {
		const summary = summarizeUtilities([{ ...BILL, amountDue: 55000 }]);

		expect(summary.totalOutstanding).toBe(55000);
		expect(summary.totalCollected).toBe(0);
		expect(summary.collectionRate).toBe(0);
	});

	it("clamps an over-credit at zero without inflating collection", () => {
		const bill = {
			...BILL,
			amountDue: -5000,
			credits: [{ amount: -60000 }],
		};
		const summary = summarizeUtilities([bill, { ...BILL, amountDue: 0 }]);

		expect(isUtilitySettled(bill)).toBe(true);
		expect(summary.totalOutstanding).toBe(0);
		expect(summary.totalCollected).toBe(55000);
		expect(summary.collectionRate).toBe(50);
	});
});
