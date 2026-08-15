import type { PaymentExportRow } from "@rently/validators";
import { describe, expect, it } from "vitest";
import {
	formatOwnerPaymentExportFilename,
	formatPaymentExportAmount,
	formatTenantPaymentExportFilename,
	PAYMENT_EXPORT_HEADERS,
	paymentExportRowsToCsv,
} from "./payment-csv";

const payment: PaymentExportRow = {
	id: "0198b7c0-1234-7abc-8def-123456789012",
	paymentDate: new Date("2026-03-31T18:30:00.000Z"),
	type: "rent",
	amount: 123_456,
	paymentMethods: "upi",
	referenceNumber: "UPI-123",
	description: "April rent",
	tenantName: "Asha Singh",
	propertyName: "Palm Residency",
	unitNumber: "A-204",
};

describe("payment CSV export", () => {
	it("writes the stable header with BOM and CRLF", () => {
		const csv = paymentExportRowsToCsv([payment]);

		expect(csv.startsWith("\uFEFF")).toBe(true);

		expect(csv.slice(1).split("\r\n")[0]).toBe(
			PAYMENT_EXPORT_HEADERS.join(","),
		);

		expect(csv.endsWith("\r\n")).toBe(true);
	});

	it("formats payment dates using the Indian timezone", () => {
		const csv = paymentExportRowsToCsv([payment]);

		expect(csv).toContain(",2026-04-01,Rent,Recorded,");
	});

	it("formats paise without floating-point conversion", () => {
		expect(formatPaymentExportAmount(1)).toBe("0.01");

		expect(formatPaymentExportAmount(100)).toBe("1.00");

		expect(formatPaymentExportAmount(-123_456)).toBe("-1234.56");
	});

	it("escapes commas, quotes, and newlines", () => {
		const csv = paymentExportRowsToCsv([
			{
				...payment,
				description: 'Rent, paid with "UPI"\non time',
			},
		]);

		expect(csv).toContain('"Rent, paid with ""UPI""\non time"');
	});

	it("neutralizes formulas in user-controlled text", () => {
		const csv = paymentExportRowsToCsv([
			{
				...payment,
				tenantName: "=2+3",
				propertyName: "+COMMAND",
				unitNumber: "@SUM",
				referenceNumber: "-10+20",
			},
		]);

		expect(csv).toContain(",'=2+3,'+COMMAND,'@SUM,");

		expect(csv).toContain(",'-10+20,");
	});

	it("keeps reversal amounts numeric and omits receipt numbers", () => {
		const csv = paymentExportRowsToCsv([
			{
				...payment,
				type: "reversal",
				amount: -123_456,
			},
		]);

		expect(csv).toContain(",Reversal,Reversal,");

		expect(csv).toContain("A-204,,-1234.56,UPI,");
	});

	it("builds a deterministic owner export filename", () => {
		expect(
			formatOwnerPaymentExportFilename({
				startDate: "2026-04-01",
				endDate: "2027-03-31",
			}),
		).toBe("keyhq-payments-2026-04-01-to-2027-03-31.csv");
	});

	it("builds a safe readable tenant export filename", () => {
		expect(formatTenantPaymentExportFilename("../Āśhā Singh?")).toBe(
			"keyhq-asha-singh-payment-history.csv",
		);

		expect(formatTenantPaymentExportFilename("आशा")).toBe(
			"keyhq-tenant-payment-history.csv",
		);
	});
});
