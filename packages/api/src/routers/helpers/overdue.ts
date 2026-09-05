import {
	differenceInCalendarDays,
	getDueDateKey,
	getLocalDateKey,
	getLocalDateParts,
} from "./rent-cycle";

export type OverdueCandidate = {
	rent: number;
	paidAmount: number;
	/** Sum of rent/general bill_credits (negative discounts + positive reversals net). */
	creditAmount: number;
	startDate: Date;
	endDate: Date | null;
	rentDueDate: number | null;
	leaseStatus: "active" | "expired" | "terminated";
};

export type OverdueState = {
	dueDate: string;
	daysOverdue: number;
	paidAmount: number;
	outstandingAmount: number;
};

export function computeOverdueState(
	row: OverdueCandidate,
	localToday: string,
): OverdueState | null {
	if (row.leaseStatus !== "active") {
		return null;
	}

	// Older leases and the current lease form may not have an explicit due day.
	// Keep the dashboard and upcoming-dues widget consistent by falling back to
	// the lease start day in that case.
	const dueDay = row.rentDueDate ?? getLocalDateParts(row.startDate).day;
	if (dueDay < 1 || dueDay > 31) {
		return null;
	}

	const startDate = getLocalDateKey(row.startDate);
	const endDate = row.endDate ? getLocalDateKey(row.endDate) : null;

	if (localToday < startDate || (endDate && localToday > endDate)) {
		return null;
	}

	const periodKey = localToday.slice(0, 7);
	const dueDate = getDueDateKey(periodKey, dueDay);

	// A lease beginning after this month's due date should not be overdue yet.
	if (startDate > dueDate || localToday <= dueDate) {
		return null;
	}

	const paidAmount = Math.max(row.paidAmount, 0);

	// Effective rent after discounts/credits (rent + negative credits + positive reversals).
	const effectiveRent = row.rent + (row.creditAmount ?? 0);

	if (paidAmount >= effectiveRent) {
		return null;
	}

	return {
		dueDate,
		daysOverdue: differenceInCalendarDays(dueDate, localToday),
		paidAmount,
		outstandingAmount: Math.max(effectiveRent - paidAmount, 0),
	};
}
