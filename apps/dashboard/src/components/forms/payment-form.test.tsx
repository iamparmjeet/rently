// @vitest-environment jsdom

import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PaymentForm, PaymentFormSchema } from "./payment-form";

afterEach(cleanup);

it("submits without the parent-owned idempotency key", async () => {
	const onSubmit = vi.fn();
	const values = {
		leaseId: "lease-1",
		amount: 100,
		paymentDate: "2026-09-16",
	};
	const parsed = PaymentFormSchema.safeParse(values);
	expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
	const { container } = render(
		<PaymentForm
			leases={[{ id: "lease-1" }]}
			leaseLabels={{ "lease-1": "Unit 101" }}
			defaultValues={values}
			onSubmit={onSubmit}
		/>,
	);

	const form = container.querySelector("form");
	expect(form).not.toBeNull();
	if (!form) return;
	fireEvent.submit(form);

	await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
});
