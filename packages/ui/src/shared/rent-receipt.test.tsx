// @vitest-environment jsdom

import type { PaymentReceiptData } from "@rently/validators";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RentReceipt } from "./rent-receipt";

afterEach(cleanup);

const receipt: PaymentReceiptData = {
	receiptNumber: "KQ-RCPT-20260807-0198F281924070008000000000000001",
	payment: {
		id: "0198f281-9240-7000-8000-000000000001",
		amount: 2_500_000,
		paymentDate: new Date("2026-08-01T00:00:00.000Z"),
		type: "rent",
		paymentMethods: "upi",
		referenceNumber: "UPI-12345",
		description: "August 2026 rent",
	},
	lease: {
		id: "0198f281-9240-7000-8000-000000000002",
		rent: 2_500_000,
		startDate: new Date("2026-01-01T00:00:00.000Z"),
		endDate: null,
	},
	property: {
		name: "Palm Residency",
		address: "1 Palm Road, Mumbai",
	},
	unit: {
		unitNumber: "A-204",
	},
	tenant: {
		name: "Tenant A",
		address: "12 Tenant Road, Mumbai",
	},
	owner: {
		name: "Owner A",
		companyName: "Owner Properties",
		address: "10 Owner Street, Mumbai",
		gstNumber: "27ABCDE1234F1Z5",
	},
};

describe("RentReceipt", () => {
	it("renders the completed logo state when printing", () => {
		const { container } = render(<RentReceipt receipt={receipt} />);
		const printStyles = container.querySelector("style")?.textContent;

		expect(printStyles).toContain(".keyhq-logo-piece");
		expect(printStyles).toContain("animation: none !important");
		expect(printStyles).toContain("transform: none !important");
	});

	it("renders the receipt and its statutory payment details", () => {
		render(<RentReceipt receipt={receipt} />);

		expect(screen.getByTitle("KeyHQ icon")).toBeTruthy();
		expect(screen.getByText("RENT RECEIPT")).toBeTruthy();
		expect(screen.getByText(receipt.receiptNumber)).toBeTruthy();
		expect(screen.getByText("Tenant A")).toBeTruthy();
		expect(screen.getByText("Owner Properties")).toBeTruthy();
		expect(
			screen.getByText("Palm Residency, 1 Palm Road, Mumbai"),
		).toBeTruthy();
		expect(screen.getByText("A-204")).toBeTruthy();
		expect(screen.getByText("₹25,000.00")).toBeTruthy();
		expect(screen.getByText("Twenty Five Thousand Rupees Only")).toBeTruthy();
	});

	it("uses landlord name and omits optional profile fields when absent", () => {
		render(
			<RentReceipt
				receipt={{
					...receipt,
					owner: {
						name: "Owner A",
						companyName: null,
						address: null,
						gstNumber: null,
					},
					tenant: {
						name: "Tenant A",
						address: null,
					},
				}}
			/>,
		);

		expect(screen.getByText("Owner A")).toBeTruthy();
		expect(screen.queryByText(/GSTIN:/)).toBeNull();
	});
});
