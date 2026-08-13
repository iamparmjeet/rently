import { describe, expect, it } from "vitest";
import { nextIndianDateStart, parseDateOnly, startOfIndianDate } from "./dates";

describe("Indian calendar date conversion", () => {
	it("parses a validated date-only value", () => {
		expect(parseDateOnly("2026-04-01")).toEqual({
			year: 2026,
			month: 4,
			day: 1,
		});
	});

	it("rejects an impossible calendar date", () => {
		expect(() => parseDateOnly("2026-02-30")).toThrow();
	});

	it("converts Indian midnight to UTC", () => {
		expect(startOfIndianDate("2026-04-01").toISOString()).toBe(
			"2026-03-31T18:30:00.000Z",
		);
	});

	it("returns the following Indian midnight", () => {
		expect(nextIndianDateStart("2026-04-01").toISOString()).toBe(
			"2026-04-01T18:30:00.000Z",
		);
	});

	it("handles month rollover", () => {
		expect(nextIndianDateStart("2026-04-30").toISOString()).toBe(
			"2026-04-30T18:30:00.000Z",
		);
	});

	it("handles year rollover", () => {
		expect(nextIndianDateStart("2026-12-31").toISOString()).toBe(
			"2026-12-31T18:30:00.000Z",
		);
	});
});
