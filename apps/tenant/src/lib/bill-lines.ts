// C07: tenant "My Bill" / Overview line construction over the period balance
// read model (rent.balance.getPeriodBalance). Replaces the full-contract-rent
// defect: rent lines now come from per-lease charges (current period vs older
// arrears shown separately), and utility lines include older unpaid bills the
// old current-calendar-month filter used to hide. Money is always the
// server-computed paise value; this module only shapes display lines.

export type BillUnit = {
	leaseId: string;
	unitNumber: string;
	status: string;
	propertyName: string;
};

// Structural subset of the read model's per-lease balance.
export type TenantBalanceSlice = {
	leaseId: string;
	currentRentDue: number;
	totalRentDue: number;
	currentPeriodKey: string;
	currentPeriodDueDate: string | null;
};

export type TenantUtilitySlice = {
	id: string;
	leaseId: string;
	utilityType: string;
	amountDue: number;
	currentReadingDate: string | Date | null;
	createdAt: string | Date;
};

export type BillLine = {
	id: string;
	emoji: string;
	label: string;
	sub: string;
	amount: number;
};

export function balanceByLeaseId<T extends { leaseId: string }>(
	balances: Array<T> | undefined,
): Map<string, T> {
	const map = new Map<string, T>();
	for (const balance of balances ?? []) map.set(balance.leaseId, balance);
	return map;
}

export function periodLabel(periodKey: string): string {
	const [year, month] = periodKey.split("-");
	const monthIndex = Number(month) - 1;
	const name = new Date(Date.UTC(2000, monthIndex, 1)).toLocaleString("en-IN", {
		month: "long",
	});
	return `${name} ${year}`;
}

export function activeUnits(
	units: Array<BillUnit & { status: string }>,
): BillUnit[] {
	return units.filter((unit) => unit.status === "active");
}

// One line per active unit for the current period's rent, plus a separate
// "previous periods" line when older charges are outstanding (the Fix-Plan's
// current/older split). Fully settled units produce no line at all — a tenant
// never sees contract rent that has already been paid.
export function buildRentLines(
	units: BillUnit[],
	balanceByLease: Map<string, TenantBalanceSlice>,
): BillLine[] {
	const lines: BillLine[] = [];
	for (const unit of units) {
		const balance = balanceByLease.get(unit.leaseId);
		if (!balance || balance.totalRentDue <= 0) continue;
		const sub = `Unit ${unit.unitNumber} · ${unit.propertyName}`;
		const olderOutstanding = balance.totalRentDue - balance.currentRentDue;
		if (balance.currentRentDue > 0) {
			lines.push({
				id: `rent-current-${unit.leaseId}`,
				emoji: "🏠",
				label: `Rent — ${periodLabel(balance.currentPeriodKey)}`,
				sub,
				amount: balance.currentRentDue,
			});
		}
		if (olderOutstanding > 0) {
			lines.push({
				id: `rent-older-${unit.leaseId}`,
				emoji: "🏠",
				label: "Rent — previous periods",
				sub,
				amount: olderOutstanding,
			});
		}
	}
	return lines;
}

// Every unpaid utility bill on an active unit, regardless of age — the old
// current-month filter made an older unpaid bill invisible to the tenant.
export function buildUtilityLines(
	units: BillUnit[],
	utilities: TenantUtilitySlice[],
): BillLine[] {
	const unitByLeaseId = new Map(units.map((unit) => [unit.leaseId, unit]));
	return utilities
		.filter(
			(utility) => utility.amountDue > 0 && unitByLeaseId.has(utility.leaseId),
		)
		.map((utility) => {
			const unit = unitByLeaseId.get(utility.leaseId);
			return {
				id: utility.id,
				emoji:
					{ electricity: "⚡", water: "💧", maintenance: "🔧" }[
						utility.utilityType
					] ?? "📄",
				label:
					utility.utilityType.charAt(0).toUpperCase() +
					utility.utilityType.slice(1),
				sub: unit ? `Unit ${unit.unitNumber} · ${unit.propertyName}` : "",
				amount: utility.amountDue,
			};
		});
}

export function summarizeLines(lines: BillLine[]): number {
	return lines.reduce((sum, line) => sum + line.amount, 0);
}

// The server's clamped current-period due date (R3) for the earliest active
// lease that has one; the client-side "1st of next month" guess is gone.
export function currentDueDate(
	units: BillUnit[],
	balanceByLease: Map<string, TenantBalanceSlice>,
): string | null {
	for (const unit of units) {
		const dueDate = balanceByLease.get(unit.leaseId)?.currentPeriodDueDate;
		if (dueDate) return dueDate;
	}
	return null;
}
