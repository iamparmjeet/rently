import { type DateOnly, DateOnlySchema } from "@rently/validators";

const INDIA_UTC_OFFSET_MINUTES = 5 * 60 + 30;

export interface IndianDateParts {
	year: number;
	month: number;
	day: number;
}

export function now(): Date {
	return new Date();
}

export function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}

export function addMonths(date: Date, months: number): Date {
	const result = new Date(date);
	const targetMonth = result.getMonth() + months;

	result.setMonth(targetMonth);

	if (result.getDate() !== date.getDate()) {
		result.setDate(0);
	}

	return result;
}

/**
 * Validates and separates a YYYY-MM-DD calendar date.
 *
 * Validation happens before splitting, so Number() cannot receive
 * malformed or missing date parts.
 */
export function parseDateOnly(value: string): IndianDateParts {
	const dateOnly = DateOnlySchema.parse(value);
	const [yearText, monthText, dayText] = dateOnly.split("-");

	if (!yearText || !monthText || !dayText) {
		throw new Error("Validated date is missing calendar parts.");
	}

	return {
		year: Number(yearText),
		month: Number(monthText),
		day: Number(dayText),
	};
}

/**
 * Converts Indian calendar parts to an exact UTC timestamp.
 *
 * India uses UTC+05:30. Therefore:
 *
 * 2026-04-01 00:00 IST
 * = 2026-03-31 18:30 UTC
 */
function indianMidnightToUtc(parts: IndianDateParts, dayOffset = 0): Date {
	const utcMidnight = new Date(0);

	utcMidnight.setUTCHours(0, 0, 0, 0);

	utcMidnight.setUTCFullYear(
		parts.year,
		parts.month - 1,
		parts.day + dayOffset,
	);

	return new Date(utcMidnight.getTime() - INDIA_UTC_OFFSET_MINUTES * 60_000);
}

/**
 * Returns 00:00 IST for a calendar date as a Date timestamp.
 */
export function startOfIndianDate(value: DateOnly): Date {
	return indianMidnightToUtc(parseDateOnly(value));
}

/**
 * Returns 00:00 IST on the day after the supplied calendar date.
 *
 * This is used as an exclusive database boundary.
 */
export function nextIndianDateStart(value: DateOnly): Date {
	return indianMidnightToUtc(parseDateOnly(value), 1);
}
