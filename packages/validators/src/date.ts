import z from "zod";

export const DateOnlySchema = z.iso.date({
	error: "Expected a valid date in YYYY-MM-DD format.",
});

export const DateRangeSchema = z
	.object({
		startDate: DateOnlySchema,
		endDate: DateOnlySchema,
	})
	.refine(({ startDate, endDate }) => startDate <= endDate, {
		message: "Start date must be on or before end date.",
		path: ["endDate"],
	});

export type DateOnly = z.infer<typeof DateOnlySchema>;
export type DateRange = z.infer<typeof DateRangeSchema>;

/** The business time zone: every business date in this product is IST. */
export const INDIA_TIME_ZONE = "Asia/Kolkata";

/**
 * The calendar date (YYYY-MM-DD) of `now` in the business time zone.
 *
 * G01: browser today-defaults used `new Date().toISOString().slice(0, 10)`
 * (UTC), so between 00:00 and 05:30 IST an owner recording "today" got
 * yesterday — while the API, jobs, and reports key by IST. This is the one
 * helper for "today" on every client; the server's equivalent is
 * `getLocalDateKey` (same rule, same zone).
 */
export function toBusinessDateKey(
	now: Date = new Date(),
	timeZone: string = INDIA_TIME_ZONE,
): string {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(now);

	const get = (type: "year" | "month" | "day") => {
		const part = parts.find((item) => item.type === type)?.value;
		if (!part) throw new Error(`Missing date part: ${type}`);
		return part;
	};

	return `${get("year")}-${get("month")}-${get("day")}`;
}
