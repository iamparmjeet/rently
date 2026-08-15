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
