// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaymentExportDialog } from "./payment-export-dialog";

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

function renderDialog(
	overrides: Partial<React.ComponentProps<typeof PaymentExportDialog>> = {},
) {
	const props: React.ComponentProps<typeof PaymentExportDialog> = {
		open: true,
		onOpenChange: vi.fn(),
		onExport: vi.fn(),
		...overrides,
	};

	render(<PaymentExportDialog {...props} />);

	return props;
}

function dateInput(label: string): HTMLInputElement {
	return screen.getByLabelText(label) as HTMLInputElement;
}

describe("PaymentExportDialog", () => {
	it("uses the previous Indian financial year before 1 April IST", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-03-31T18:29:59.999Z"));

		renderDialog();

		expect(dateInput("Start Date").value).toBe("2025-04-01");
		expect(dateInput("End date").value).toBe("2026-03-31");
	});

	it("starts a new Indian financial year at midnight on 1 April IST", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-03-31T18:30:00.000Z"));

		renderDialog();

		expect(dateInput("Start Date").value).toBe("2026-04-01");
		expect(dateInput("End date").value).toBe("2027-03-31");
	});

	it("blocks a reversed range and explains the error", () => {
		const { onExport } = renderDialog();

		fireEvent.change(dateInput("Start Date"), {
			target: { value: "2026-08-02" },
		});
		fireEvent.change(dateInput("End date"), {
			target: { value: "2026-08-01" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Download CSV" }));

		expect(
			screen.getByText("Start date must be on or before end date."),
		).toBeTruthy();
		expect(onExport).not.toHaveBeenCalled();
	});

	it("submits the exact selected date-only values", () => {
		const { onExport } = renderDialog();

		fireEvent.change(dateInput("Start Date"), {
			target: { value: "2026-04-15" },
		});
		fireEvent.change(dateInput("End date"), {
			target: { value: "2026-07-31" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Download CSV" }));

		expect(onExport).toHaveBeenCalledOnce();
		expect(onExport).toHaveBeenCalledWith({
			startDate: "2026-04-15",
			endDate: "2026-07-31",
		});
	});

	it("locks dialog actions while an export is being prepared", () => {
		renderDialog({ isExporting: true });

		expect(dateInput("Start Date").disabled).toBe(true);
		expect(dateInput("End date").disabled).toBe(true);
		expect(
			(screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement)
				.disabled,
		).toBe(true);
		expect(
			(screen.getByRole("button", { name: "Preparing…" }) as HTMLButtonElement)
				.disabled,
		).toBe(true);
	});
});
