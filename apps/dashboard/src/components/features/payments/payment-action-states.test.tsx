// @vitest-environment jsdom

// H05 regression rationale: voiding an already-reversed original is a no-op
// the server absorbs idempotently (B04), and voiding a reversal row is
// refused — yet both actions stayed clickable, and a voided original showed
// no label (only a missing Paid badge). These tests pin the row/card states:
// Void is offered exactly for actionable payments, and voided originals are
// labeled Voided. (Plain null/disabled assertions: this repo has no jest-dom
// setup, so no toBeInTheDocument/toBeDisabled matchers.)
import { PAYMENT_TYPES } from "@rently/db/constants/rent-constants";
import type { PaymentListItem } from "@rently/validators";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaymentCard } from "./payment-card";
import { PaymentRow } from "./payment-row";

afterEach(() => {
	cleanup();
});

function payment(overrides: Partial<PaymentListItem> = {}): PaymentListItem {
	return {
		id: "pay-1",
		leaseId: "lease-1",
		agreementId: null,
		tenantId: "tenant-1",
		utilityId: null,
		paymentGroupId: null,
		type: PAYMENT_TYPES.RENT,
		amount: 100_000,
		paymentDate: new Date("2026-09-01T00:00:00.000Z"),
		paymentMethods: "upi",
		referenceNumber: null,
		description: null,
		reversesPaymentId: null,
		tenantName: "Tenant A",
		tenantPhone: null,
		createdAt: new Date("2026-09-01T00:00:00.000Z"),
		updatedAt: new Date("2026-09-01T00:00:00.000Z"),
		...overrides,
	} as PaymentListItem;
}

function voidButton() {
	return screen.queryByRole("button", { name: "Void" });
}

describe("PaymentCard action states (H05)", () => {
	it("offers Void for an actionable payment", () => {
		render(
			<PaymentCard payment={payment()} onVoid={vi.fn()} onClick={vi.fn()} />,
		);
		expect(voidButton()).not.toBeNull();
		expect(screen.queryByText("Voided")).toBeNull();
	});

	it("hides Void for a reversal row", () => {
		render(
			<PaymentCard
				payment={payment({ type: PAYMENT_TYPES.REVERSAL, amount: -100_000 })}
				onVoid={vi.fn()}
				onClick={vi.fn()}
			/>,
		);
		expect(voidButton()).toBeNull();
	});

	it("hides Void and labels a voided original", () => {
		render(
			<PaymentCard
				payment={payment()}
				isReversed
				onVoid={vi.fn()}
				onClick={vi.fn()}
			/>,
		);
		expect(voidButton()).toBeNull();
		expect(screen.queryByText("Voided")).not.toBeNull();
	});
});

describe("PaymentRow action states (H05)", () => {
	it("offers Void Payment in the menu for an actionable payment", () => {
		render(
			<PaymentRow payment={payment()} onVoid={vi.fn()} onClick={vi.fn()} />,
		);
		const trigger = screen.getByLabelText(
			"Payment actions",
		) as HTMLButtonElement;
		expect(trigger.disabled).toBe(false);
		fireEvent.click(trigger);
		expect(screen.queryByText("Void Payment")).not.toBeNull();
	});

	it("offers no actions menu for a reversal row", () => {
		render(
			<PaymentRow
				payment={payment({ type: PAYMENT_TYPES.REVERSAL, amount: -100_000 })}
				onVoid={vi.fn()}
				onClick={vi.fn()}
			/>,
		);
		expect(screen.queryByLabelText("Payment actions")).toBeNull();
	});

	it("offers no actions menu and labels a voided original", () => {
		render(
			<PaymentRow
				payment={payment()}
				isReversed
				onVoid={vi.fn()}
				onClick={vi.fn()}
			/>,
		);
		expect(screen.queryByLabelText("Payment actions")).toBeNull();
		expect(screen.queryByText("Voided")).not.toBeNull();
	});
});
