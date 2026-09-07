// G01 India business date — regression rationale:
// Browser today-defaults used the UTC calendar date, so from 00:00 to 05:30
// IST an owner recording "today" got yesterday while the API, jobs, and
// reports key by IST. Each case pins the helper against the UTC version at
// the same instant; run this file under a non-IST process TZ as well (the
// helper pins Asia/Kolkata explicitly, never the ambient locale).
import { afterEach, describe, expect, it, vi } from "vitest";
import { toBusinessDateKey } from "./date";

function utcDay(instant: string): string {
	return new Date(instant).toISOString().slice(0, 10);
}

afterEach(() => {
	vi.useRealTimers();
});

describe("toBusinessDateKey", () => {
	it("reports the IST date inside the 00:00-05:30 window", async () => {
		// 00:30 IST on Sep 2; UTC still shows Sep 1.
		vi.setSystemTime(new Date("2026-09-01T19:00:00.000Z"));
		expect(utcDay(new Date().toISOString())).toBe("2026-09-01");
		expect(toBusinessDateKey()).toBe("2026-09-02");
	});

	it("holds month and year boundaries across the offset", async () => {
		// Sep 1 00:00 IST (Aug 31 UTC) and Jan 1 00:00 IST (Dec 31 UTC).
		vi.setSystemTime(new Date("2026-08-31T18:30:00.000Z"));
		expect(toBusinessDateKey()).toBe("2026-09-01");
		vi.setSystemTime(new Date("2025-12-31T18:30:00.000Z"));
		expect(toBusinessDateKey()).toBe("2026-01-01");
	});

	it("keeps day 29-31 month ends intact", async () => {
		// Jan 31 and leap-day Feb 29 as seen in IST.
		vi.setSystemTime(new Date("2026-01-30T18:30:00.000Z"));
		expect(toBusinessDateKey()).toBe("2026-01-31");
		vi.setSystemTime(new Date("2024-02-28T18:30:00.000Z"));
		expect(toBusinessDateKey()).toBe("2024-02-29");
	});

	it("formats an explicit instant the same under any ambient locale", async () => {
		expect(toBusinessDateKey(new Date("2026-09-01T19:00:00.000Z"))).toBe(
			"2026-09-02",
		);
	});
});
