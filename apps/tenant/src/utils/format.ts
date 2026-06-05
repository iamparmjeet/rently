export function rupees(paise: number): string {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(paise / 100);
}

// Compact version for stat tiles: "₹15,000" without the space
export function rupeesCompact(paise: number): string {
	return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

// Format a Date or ISO string into "5 Jun 2026"
export function fmtDate(date: Date | string | null | undefined): string {
	if (!date) return "—";
	return new Date(date).toLocaleDateString("en-IN", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

// Format month label: "Jun 2026"
export function fmtMonth(date: Date | string | null | undefined): string {
	if (!date) return "—";
	return new Date(date).toLocaleDateString("en-IN", {
		month: "long",
		year: "numeric",
	});
}

// Get the next occurrence of the 1st day of next month
export function nextRentDueDate(): Date {
	const now = new Date();
	return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

// Days until a date (negative = overdue)
export function daysUntil(date: Date): number {
	return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
