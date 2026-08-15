// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
	getUtilityDocumentAction,
	isUtilityRowActionTarget,
} from "./utility-row-actions";

describe("isUtilityRowActionTarget", () => {
	it("identifies clicks inside a row action", () => {
		const action = document.createElement("button");
		action.dataset.utilityRowAction = "";
		const icon = document.createElement("span");
		action.appendChild(icon);

		expect(isUtilityRowActionTarget(icon)).toBe(true);
	});

	it("allows clicks on the bill row itself to open its detail", () => {
		expect(isUtilityRowActionTarget(document.createElement("div"))).toBe(false);
	});

	it("offers a bill download when a utility has no payment receipt", () => {
		expect(
			getUtilityDocumentAction({
				utilityId: "utility-123",
				receiptPaymentId: null,
			}),
		).toEqual({
			href: "/utilities/utility-123?print=true",
			label: "Download bill",
			title: "Open a printable utility bill",
		});
	});

	it("offers a receipt only when a real payment exists", () => {
		expect(
			getUtilityDocumentAction({
				utilityId: "utility-123",
				receiptPaymentId: "payment-456",
			}),
		).toEqual({
			href: "/receipts/payment-456?print=true",
			label: "Download receipt",
			title: "Open a printable payment receipt",
		});
	});
});
