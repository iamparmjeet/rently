import { describe, expect, it } from "vitest";
import { formatDashboardDate } from "./dashboard-date";

describe("formatDashboardDate", () => {
	it("formats the calendar date in the product timezone", () => {
		expect(formatDashboardDate(new Date("2026-08-06T20:00:00.000Z"))).toBe(
			"Friday, 7 August 2026",
		);
	});
});
