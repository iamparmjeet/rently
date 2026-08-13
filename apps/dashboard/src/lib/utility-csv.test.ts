import { describe, expect, it } from "vitest";
import { UTILITY_EXPORT_HEADERS, utilityExportRowsToCsv } from "./utility-csv";

const utility = {
	id: "d0f4a8cf-6927-4e2a-8a47-3cd352ee41fb",
	leaseId: "9d9e2a66-4d5e-4da9-a056-0c5e7432a059",
	batchId: "a2fc97f8-0ed2-499f-9ffa-368ce50ca2c7",
	utilityType: "electricity" as const,
	previousReadingDate: new Date("2026-01-01T00:00:00.000Z"),
	currentReadingDate: new Date("2026-01-31T00:00:00.000Z"),
	previousReading: 100,
	currentReading: 135.5,
	unitsUsed: 35.5,
	ratePerUnit: 850,
	fixedCharge: 10000,
	totalAmount: 40175,
	description: "=SUM(A1:A2)",
	isPaid: true,
	createdAt: new Date("2026-01-31T00:00:00.000Z"),
	updatedAt: new Date("2026-01-31T00:00:00.000Z"),
	unitNumber: "A-101",
	propertyName: "Example Heights",
	tenantName: "Taylor",
	tenantPhone: null,
	tenantEmail: null,
	receiptPaymentId: "b5a2b7b2-93d1-4888-a14d-0dba7ea7a007",
};

describe("utility CSV export", () => {
	it("writes the expected columns and exact monetary amounts", () => {
		const csv = utilityExportRowsToCsv([utility]);

		expect(csv).toContain(UTILITY_EXPORT_HEADERS.join(","));
		expect(csv).toContain(",8.50,100.00,401.75,");
		expect(csv).toContain(",Paid,");
	});

	it("neutralizes formula-like descriptions", () => {
		const csv = utilityExportRowsToCsv([utility]);

		expect(csv).toContain("'=SUM(A1:A2)");
	});

	it("exports legacy fractional-rupee rates without failing", () => {
		const csv = utilityExportRowsToCsv([{ ...utility, ratePerUnit: 8.5 }]);

		expect(csv).toContain(",8.50,100.00,401.75,");
	});
});
