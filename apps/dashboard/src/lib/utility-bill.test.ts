import { describe, expect, it } from "vitest";
import {
	getUtilityBillChargeLines,
	getUtilityBillNumber,
} from "./utility-bill";

describe("utility bill presentation", () => {
	it("creates a stable, labelled bill number", () => {
		expect(getUtilityBillNumber("019ffbfb-25ea-737f-b9fe-13957ae4165c")).toBe(
			"KQ-UTL-13957AE4165C",
		);
	});

	it("itemizes a reconciled electricity charge", () => {
		expect(
			getUtilityBillChargeLines({
				utilityType: "electricity",
				unitsUsed: 100,
				ratePerUnit: 850,
				fixedCharge: 15_000,
				totalAmount: 100_000,
				description: null,
			}),
		).toEqual([
			{
				label: "Electricity usage",
				detail: "100.00 units",
				amount: 85_000,
			},
			{ label: "Fixed charge", detail: null, amount: 15_000 },
		]);
	});

	it("does not print a misleading formula for inconsistent legacy data", () => {
		expect(
			getUtilityBillChargeLines({
				utilityType: "electricity",
				unitsUsed: 100,
				ratePerUnit: 8.5,
				fixedCharge: 15_000,
				totalAmount: 100_000,
				description: null,
			}),
		).toEqual([
			{
				label: "Electricity",
				detail: "100.00 units recorded",
				amount: 100_000,
			},
		]);
	});
});
