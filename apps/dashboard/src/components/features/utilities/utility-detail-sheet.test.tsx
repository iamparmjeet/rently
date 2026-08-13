// @vitest-environment jsdom

import type { UtilityListItem } from "@rently/validators";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UtilityDetailDialog } from "./utility-detail-sheet";

afterEach(cleanup);

const utility: UtilityListItem = {
	id: "d0f4a8cf-6927-4e2a-8a47-3cd352ee41fb",
	leaseId: "9d9e2a66-4d5e-4da9-a056-0c5e7432a059",
	batchId: "a2fc97f8-0ed2-499f-9ffa-368ce50ca2c7",
	utilityType: "electricity",
	previousReadingDate: new Date("2026-01-01T00:00:00.000Z"),
	currentReadingDate: new Date("2026-01-31T00:00:00.000Z"),
	previousReading: 100,
	currentReading: 135.5,
	unitsUsed: 35.5,
	ratePerUnit: 850,
	fixedCharge: 10000,
	totalAmount: 40175,
	description: null,
	isPaid: false,
	createdAt: new Date("2026-01-31T00:00:00.000Z"),
	updatedAt: new Date("2026-01-31T00:00:00.000Z"),
	unitNumber: "A-101",
	propertyName: "Example Heights",
	tenantName: "Taylor",
	tenantPhone: null,
	tenantEmail: null,
	receiptPaymentId: null,
};

describe("UtilityDetailDialog", () => {
	it("shows a utility bill in a centered dialog instead of a side sheet", () => {
		const { container } = render(
			<UtilityDetailDialog
				items={[utility]}
				open
				onOpenChange={vi.fn()}
				onEdit={vi.fn()}
				onMarkPaid={vi.fn()}
			/>,
		);

		expect(
			container.ownerDocument.querySelector('[data-slot="dialog-content"]'),
		).toBeTruthy();
		expect(
			container.ownerDocument.querySelector('[data-slot="sheet-content"]'),
		).toBeNull();
	});
});
