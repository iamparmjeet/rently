import { differenceInCalendarDays } from "./rent-cycle";

// C08 cutover: overdue state derives from the period ledger — one entry per
// charge (rent_charges with its snapshotted clamped due date and remaining
// paise), never from the lifetime heuristic. The earliest overdue charge
// anchors the state; older arrears aggregate into `outstandingAmount` so the
// owner sees the full arrear while reminders stay per-period (R14).

export type OverdueCharge = {
	periodKey: string;
	dueDate: string;
	amount: number;
	outstanding: number;
};

export type OverdueState = {
	/** Period key of the earliest overdue charge (notification dedupe anchor). */
	periodKey: string;
	dueDate: string;
	daysOverdue: number;
	paidAmount: number;
	outstandingAmount: number;
};

export function computeLeaseOverdue(
	charges: OverdueCharge[],
	startDate: Date,
	localToday: string,
): OverdueState | null {
	// Stored timestamps are UTC; their wall-clock date part is the business
	// date (R1, C03 convention — the accrual formula uses the same part).
	const startDateKey = startDate.toISOString().slice(0, 10);

	let earliest: OverdueCharge | null = null;
	let outstandingAmount = 0;
	let paidTowardOverdue = 0;
	for (const charge of charges) {
		if (charge.outstanding <= 0) continue;
		// A lease beginning after its period's due date is not overdue for that
		// period (R3 — the shipped overdue skip, generalized to stored charges).
		if (charge.dueDate < startDateKey) continue;
		if (charge.dueDate >= localToday) continue;
		if (!earliest || charge.dueDate < earliest.dueDate) earliest = charge;
		outstandingAmount += charge.outstanding;
		paidTowardOverdue += Math.max(charge.amount - charge.outstanding, 0);
	}

	if (!earliest) return null;

	return {
		periodKey: earliest.periodKey,
		dueDate: earliest.dueDate,
		daysOverdue: differenceInCalendarDays(earliest.dueDate, localToday),
		paidAmount: paidTowardOverdue,
		outstandingAmount,
	};
}
