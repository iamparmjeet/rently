import { describe, expect, it } from "vitest";
import { getCollectionHealth } from "./payment-collection-health";

const referenceDate = new Date("2026-09-15T12:00:00.000Z");

describe("collection health", () => {
	it("uses the payment amount already reduced by a utility discount", () => {
		const health = getCollectionHealth({
			referenceDate,
			payments: [
				{
					amount: 850_000,
					paymentDate: new Date("2026-09-10T12:00:00.000Z"),
				},
			],
		});

		expect(health).toEqual({
			amount: 850_000,
			transactionCount: 1,
		});
	});

	it("nets a void reversal against its original payment", () => {
		const health = getCollectionHealth({
			referenceDate,
			payments: [
				{
					amount: 1_000_000,
					paymentDate: new Date("2026-09-10T12:00:00.000Z"),
				},
				{
					amount: -1_000_000,
					paymentDate: new Date("2026-09-12T12:00:00.000Z"),
				},
			],
		});

		expect(health).toEqual({
			amount: 0,
			transactionCount: 2,
		});
	});

	it("excludes payments outside the current month", () => {
		const health = getCollectionHealth({
			referenceDate,
			payments: [
				{
					amount: 1_000_000,
					paymentDate: new Date("2026-09-10T12:00:00.000Z"),
				},
				{
					amount: 500_000,
					paymentDate: new Date("2026-08-31T12:00:00.000Z"),
				},
			],
		});

		expect(health).toEqual({
			amount: 1_000_000,
			transactionCount: 1,
		});
	});

	it("nets every payment for all-time collection", () => {
		const health = getCollectionHealth({
			referenceDate,
			scope: "all-time",
			payments: [
				{
					amount: 1_000_000,
					paymentDate: new Date("2026-08-31T12:00:00.000Z"),
				},
				{
					amount: -250_000,
					paymentDate: new Date("2026-09-10T12:00:00.000Z"),
				},
			],
		});

		expect(health).toEqual({
			amount: 750_000,
			transactionCount: 2,
		});
	});
});
