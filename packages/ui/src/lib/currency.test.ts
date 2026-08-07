import { describe, expect, it } from "vitest";
import { formatFormRupees, rupeesToWords } from "./currency";

describe("formatFormRupees", () => {
	it("formats lease values as rupees without paise conversion", () => {
		expect(formatFormRupees(1_500)).toBe("₹1,500.00");
	});
});

describe("rupeesToWords", () => {
	it("formats zero and whole rupees", () => {
		expect(rupeesToWords(0)).toBe("Zero Rupees Only");
		expect(rupeesToWords(100)).toBe("One Rupee Only");
	});

	it("uses Indian lakh and crore groups", () => {
		expect(rupeesToWords(123_456_789)).toBe(
			"Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Rupees and Eighty Nine Paise Only",
		);
		expect(rupeesToWords(1_000_000_000)).toBe("One Crore Rupees Only");
	});

	it("uses singular paisa where appropriate", () => {
		expect(rupeesToWords(10_001)).toBe("One Hundred Rupees and One Paisa Only");
	});

	it("rejects negative and non-integer values", () => {
		expect(() => rupeesToWords(-1)).toThrow();
		expect(() => rupeesToWords(1.5)).toThrow();
	});
});
