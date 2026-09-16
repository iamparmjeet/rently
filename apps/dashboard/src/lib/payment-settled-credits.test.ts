import { describe, expect, it } from "vitest";
import {
	getNetDiscountDisplayAmount,
	getNetSettledDiscountTotal,
} from "./payment-settled-credits";

describe("settled payment credits", () => {
	it("excludes an unpaid utility discount from the settled total", () => {
		const credits = [
			{
				amount: -45_000,
				leaseId: "lease-1",
				type: "discount",
				utilityId: "utility-1",
			},
		];

		expect(getNetSettledDiscountTotal(credits, [])).toBe(0);
	});

	it("includes a utility discount after its discounted bill is paid", () => {
		const credits = [
			{
				amount: -45_000,
				leaseId: "lease-1",
				type: "discount",
				utilityId: "utility-1",
			},
		];
		const payments = [
			{
				leaseId: "lease-1",
				type: "utility",
				utilityId: "utility-1",
			},
		];

		expect(getNetSettledDiscountTotal(credits, payments)).toBe(-45_000);
	});

	it("does not format a zero discount total as negative zero", () => {
		const displayAmount = getNetDiscountDisplayAmount(0);

		expect(displayAmount).toBe(0);
		expect(Object.is(displayAmount, -0)).toBe(false);
	});
});
