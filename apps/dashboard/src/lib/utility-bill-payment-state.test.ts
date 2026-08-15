import { describe, expect, it } from "vitest";
import { getUtilityBillPaymentState } from "./utility-bill-payment-state";

describe("utility bill payment state", () => {
	it("labels a paid utility as amount paid", () => {
		expect(
			getUtilityBillPaymentState({
				isPaid: true,
				hasPaymentReceipt: false,
			}),
		).toEqual({
			amountLabel: "Amount paid",
			statusLabel: "Marked as paid",
		});
	});

	it("labels an unpaid utility as total due", () => {
		expect(
			getUtilityBillPaymentState({
				isPaid: false,
				hasPaymentReceipt: false,
			}),
		).toEqual({
			amountLabel: "Total due",
			statusLabel: "Payment pending",
		});
	});
});
