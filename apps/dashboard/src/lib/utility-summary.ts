// H02: one derivation for every utility summary. Server amountDue already
// nets total + credits − signed payments; the client only derives display
// semantics from it — settled, outstanding (floored, so over-credits read as
// zero due instead of negative), and the collected portion. amountDue is
// optional so partially-loaded rows fall back to the gross total.
export type SummaryBill = {
	totalAmount: number;
	amountDue?: number;
	credits?: Array<{ amount: number }>;
};

/** Server due when present, else the gross bill total. */
export function utilityDue(bill: SummaryBill): number {
	return bill.amountDue ?? bill.totalAmount;
}

/** Settled means nothing remains — not the stale isPaid flag. */
export function isUtilitySettled(bill: SummaryBill): boolean {
	return utilityDue(bill) <= 0;
}

/** Outstanding, floored at zero so over-credits never drive totals down. */
export function utilityOutstanding(bill: SummaryBill): number {
	return Math.max(0, utilityDue(bill));
}

/** Paid portion: total + credits − due, floored (discounts are not collections). */
export function utilityCollected(bill: SummaryBill): number {
	const creditsSum = (bill.credits ?? []).reduce((sum, c) => sum + c.amount, 0);
	return Math.max(0, bill.totalAmount + creditsSum - utilityDue(bill));
}

export type UtilitySummary = {
	totalBilled: number;
	totalCollected: number;
	totalOutstanding: number;
	settledRecords: number;
	totalRecords: number;
	collectionRate: number;
};

export function summarizeUtilities(bills: SummaryBill[]): UtilitySummary {
	const totalBilled = bills.reduce((sum, bill) => sum + bill.totalAmount, 0);
	const totalCollected = bills.reduce(
		(sum, bill) => sum + utilityCollected(bill),
		0,
	);
	const totalOutstanding = bills.reduce(
		(sum, bill) => sum + utilityOutstanding(bill),
		0,
	);
	return {
		totalBilled,
		totalCollected,
		totalOutstanding,
		settledRecords: bills.filter(isUtilitySettled).length,
		totalRecords: bills.length,
		collectionRate:
			totalBilled > 0
				? Math.min(100, Math.round((totalCollected / totalBilled) * 100))
				: 0,
	};
}
