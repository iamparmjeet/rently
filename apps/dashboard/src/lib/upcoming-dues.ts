// C06: Upcoming Dues selection over the period balance read model
// (rent.balance.getPeriodBalance). Everything financial here is a
// server-computed paise value — this module only classifies and sorts.
// Replaces the old "sum this month's rent payments and compare to rent"
// heuristic, which ignored credits, arrears, reversals, and period edges.

export type DueUrgency = "overdue" | "today" | "soon" | "upcoming";

export type DueLeaseInput = {
	leaseId: string;
	tenantName: string | null;
	unitNumber: string;
	propertyName: string;
	rent: number;
	rentDueDate: number | null;
	startDate: Date | string;
};

// Structural subset of the read model's per-lease balance (keeps the helper
// testable without importing the API client types).
export type LeaseBalanceInput = {
	leaseId: string;
	totalRentDue: number;
	overdueRent: number;
	currentPeriodDueDate: string | null;
};

export type DueEntry = {
	leaseId: string;
	tenantName: string;
	unitNumber: string;
	propertyName: string;
	amount: number;
	dueDate: Date;
	daysUntil: number;
	urgency: DueUrgency;
};

function startOfDay(date: Date): Date {
	const copy = new Date(date);
	copy.setHours(0, 0, 0, 0);
	return copy;
}

// Fallback for leases whose balance carries no current-period due date (no
// charge exists for the current period): clamp min(dueDay, month length)
// against the month, no carry-over (R3) — for this month and, when the
// clamped day already passed, the next one too.
function getFallbackDueDate(
	startDate: Date | string,
	rentDueDate: number | null,
	today: Date,
): Date {
	const dueDayRaw = rentDueDate ?? new Date(startDate).getDate();
	const todayMidnight = startOfDay(today);

	const clampedDueIn = (year: number, monthIndex: number): Date => {
		const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
		return new Date(year, monthIndex, Math.min(dueDayRaw, daysInMonth));
	};

	const thisMonthDue = clampedDueIn(
		todayMidnight.getFullYear(),
		todayMidnight.getMonth(),
	);
	if (thisMonthDue >= todayMidnight) return thisMonthDue;
	return clampedDueIn(
		todayMidnight.getFullYear(),
		todayMidnight.getMonth() + 1,
	);
}

function getDaysUntil(date: Date, today: Date): number {
	const todayMidnight = startOfDay(today);
	const dueMidnight = startOfDay(date);
	return Math.round(
		(dueMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24),
	);
}

function classifyUrgency(
	balance: LeaseBalanceInput,
	daysUntil: number,
): DueUrgency {
	// Any outstanding arrears (previous periods, or a current period past its
	// due date) make the lease overdue now — regardless of the next due date.
	if (balance.overdueRent > 0 || daysUntil < 0) return "overdue";
	if (daysUntil === 0) return "today";
	if (daysUntil <= 7) return "soon";
	return "upcoming";
}

export function selectDueEntries(
	leases: DueLeaseInput[],
	balanceByLease: Map<string, LeaseBalanceInput>,
	today: Date,
): DueEntry[] {
	const entries: DueEntry[] = [];
	for (const lease of leases) {
		const balance = balanceByLease.get(lease.leaseId);
		// Fully settled (paid, or prepaid future periods with nothing outstanding)
		// leases are not dues.
		if (!balance || balance.totalRentDue <= 0) continue;

		const dueDate = balance.currentPeriodDueDate
			? new Date(`${balance.currentPeriodDueDate}T00:00:00`)
			: getFallbackDueDate(lease.startDate, lease.rentDueDate, today);
		const daysUntil = getDaysUntil(dueDate, today);

		entries.push({
			leaseId: lease.leaseId,
			tenantName: lease.tenantName ?? "Unknown Tenant",
			unitNumber: lease.unitNumber,
			propertyName: lease.propertyName,
			amount: balance.totalRentDue,
			dueDate,
			daysUntil,
			urgency: classifyUrgency(balance, daysUntil),
		});
	}

	// Most urgent first: overdue (arrears first, then most days past due),
	// then today/soon/upcoming by days until due.
	const urgencyRank: Record<DueUrgency, number> = {
		overdue: 0,
		today: 1,
		soon: 2,
		upcoming: 3,
	};
	return entries
		.sort(
			(a, b) =>
				urgencyRank[a.urgency] - urgencyRank[b.urgency] ||
				a.daysUntil - b.daysUntil,
		)
		.slice(0, 6);
}

export function countOverdueLeases(
	balances: Array<Pick<LeaseBalanceInput, "overdueRent">> | undefined,
): number {
	return (balances ?? []).filter((balance) => balance.overdueRent > 0).length;
}

export function sumOverdueRent(
	balances: Array<Pick<LeaseBalanceInput, "overdueRent">> | undefined,
): number {
	return (balances ?? []).reduce(
		(sum, balance) => sum + balance.overdueRent,
		0,
	);
}
