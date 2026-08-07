import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("resend", () => ({
	Resend: class {
		emails = { send: mocks.send };
	},
}));

import { sendPaymentReceiptEmail, sendUtilityBillEmail } from "./index";

describe("KeyHQ tenant email templates", () => {
	beforeEach(() => mocks.send.mockReset());

	it("renders an escaped payment receipt with Indian formatting", async () => {
		mocks.send.mockResolvedValue({ error: null });
		await sendPaymentReceiptEmail({
			to: "tenant@example.com",
			tenantName: "A <Tenant>",
			ownerName: "O & Owner",
			propertyName: "Palm <Residency>",
			unitNumber: "A-1",
			amount: 125000,
			paymentDate: new Date("2026-08-01T00:00:00Z"),
			paymentType: "rent",
			paymentMethod: null,
		});

		const html = mocks.send.mock.calls.at(-1)?.[0].html as string;
		expect(html).toContain("KeyHQ");
		expect(html).toContain("₹1,250");
		expect(html).toContain("A &lt;Tenant&gt;");
		expect(html).toContain("O &amp; Owner");
		expect(html).not.toContain("A <Tenant>");
		expect(html).toContain("Not provided");
	});

	it("combines utility rows into one total and safely handles optional values", async () => {
		mocks.send.mockResolvedValue({ error: null });
		await sendUtilityBillEmail({
			to: "tenant@example.com",
			tenantName: "Tenant",
			ownerName: "Owner",
			propertyName: "Palm Residency",
			unitNumber: "A-1",
			billingDate: "2026-08-01",
			utilities: [
				{ utilityType: "electricity", totalAmount: 10000, unitsUsed: 12 },
				{ utilityType: "water", totalAmount: 2500 },
			],
		});

		const html = mocks.send.mock.calls.at(-1)?.[0].html as string;
		expect(mocks.send).toHaveBeenCalledTimes(1);
		expect(html).toContain("₹125");
		expect(html).toContain("₹100");
		expect(html).toContain("₹25");
		expect(html).toContain("—");
	});
});
