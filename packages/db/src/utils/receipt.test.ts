import { describe, expect, it } from "vitest";
import { generateReceiptNumber } from "./receipt";

function uuidV7At(timestamp: Date): string {
	const hex = timestamp.getTime().toString(16).padStart(12, "0");
	return `${hex.slice(0, 8)}-${hex.slice(8)}-7000-8000-000000000001`;
}

describe("generateReceiptNumber", () => {
	it("uses the UUIDv7 creation date in Asia/Kolkata and preserves the full ID", () => {
		const paymentId = uuidV7At(new Date("2026-08-07T12:00:00.000Z"));

		expect(generateReceiptNumber(paymentId)).toBe(
			`KQ-RCPT-20260807-${paymentId.replaceAll("-", "").toUpperCase()}`,
		);
	});

	it("uses the product timezone at a UTC day boundary", () => {
		const paymentId = uuidV7At(new Date("2026-08-06T20:00:00.000Z"));

		expect(generateReceiptNumber(paymentId)).toContain("KQ-RCPT-20260807-");
	});

	it("rejects non-UUIDv7 payment IDs", () => {
		expect(() => generateReceiptNumber(crypto.randomUUID())).toThrow(
			"Payment ID must be a valid UUIDv7.",
		);
	});
});
