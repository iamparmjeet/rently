export const INDIA_TIME_ZONE = "Asia/Kolkata";

/**
 * A calendar date such as "2026-04-01".
 *
 * This is intentionally a string because it represents a calendar day,
 * not a moment in time.
 */

export type DateOnly = string;

export interface DateRange {
	startDate: DateOnly;
	endDate: DateOnly;
}

export interface CalendarDateParts {
	year: number;
	month: number;
	day: number;
}

function getNumericPart(
	parts: Intl.DateTimeFormatPart[],
	type: "year" | "month" | "day",
): number {
	const value = parts.find((part) => part.type === type)?.value;

	if (!value) {
		throw new Error(`Missing date part: ${type}`);
	}
	return Number(value);
}

/**
 * Returns the calendar parts of a Date in a specific timezone.
 *
 * A JavaScript Date represents a moment in time. This function answers:
 * "Which calendar day is that moment in this timezone?"
 */

export function getCalendarDateParts(
	date: Date,
	timeZone = INDIA_TIME_ZONE,
): CalendarDateParts {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(date);

	return {
		year: getNumericPart(parts, "year"),
		month: getNumericPart(parts, "month"),
		day: getNumericPart(parts, "day"),
	};
}

/**
 * Builds the YYYY-MM-DD format required by <input type="date">.
 */
export function formatDateOnly({
	year,
	month,
	day,
}: CalendarDateParts): DateOnly {
	return [
		String(year).padStart(4, "0"),
		String(month).padStart(2, "0"),
		String(day).padStart(2, "0"),
	].join("-");
}

/**
 * Returns the current Indian financial year.
 *
 * Indian financial years run from 1 April through 31 March.
 */
export function getCurrentIndianFinancialYear(now = new Date()): DateRange {
	const { year, month } = getCalendarDateParts(now, INDIA_TIME_ZONE);

	const startYear = month >= 4 ? year : year - 1;

	return {
		startDate: formatDateOnly({
			year: startYear,
			month: 4,
			day: 1,
		}),
		endDate: formatDateOnly({
			year: startYear + 1,
			month: 3,
			day: 31,
		}),
	};
}

/**
 * YYYY-MM-DD strings can be ordered lexicographically because every
 * part has a fixed width and appears largest-to-smallest.
 */
export function isOrderedDateRange({ startDate, endDate }: DateRange): boolean {
	return startDate <= endDate;
}

export function Year(): number {
	return getCalendarDateParts(new Date(), INDIA_TIME_ZONE).year;
}
