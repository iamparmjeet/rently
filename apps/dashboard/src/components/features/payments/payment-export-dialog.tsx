"use client";

import { Button } from "@rently/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@rently/ui/components/dialog";
import { Input } from "@rently/ui/components/input";
import {
	type DateRange,
	getCurrentIndianFinancialYear,
	isOrderedDateRange,
} from "@rently/ui/lib/date";
import { IconDownload } from "@tabler/icons-react";
import { useEffect, useState } from "react";

interface PaymentExportDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onExport: (range: DateRange) => void;
	isExporting?: boolean;
}

export function PaymentExportDialog({
	open,
	onExport,
	onOpenChange,
	isExporting = false,
}: PaymentExportDialogProps) {
	const [range, setRange] = useState<DateRange>({
		startDate: "",
		endDate: "",
	});
	const [rangeError, setRangeError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;

		setRange(getCurrentIndianFinancialYear());
		setRangeError(null);
	}, [open]);

	function updateRange(field: keyof DateRange, value: string) {
		setRange((currentRange) => ({
			...currentRange,
			[field]: value,
		}));
		setRangeError(null);
	}

	function handleExport() {
		if (!range.startDate || !range.endDate) {
			setRangeError("Both dates are required.");
			return;
		}

		if (!isOrderedDateRange(range)) {
			setRangeError("Start date must be on or before end date.");
			return;
		}

		setRangeError(null);
		onExport(range);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Export payments</DialogTitle>
					<DialogDescription>
						Download a CSV for tax filing or reconciliation. Reversals are
						included as negative amounts.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 sm:grid-cols-2">
					<label
						htmlFor="payment-export-start-date"
						className="grid gap-1.5 font-medium text-xs"
					>
						Start Date
						<Input
							id="payment-export-start-date"
							type="date"
							value={range.startDate}
							onChange={(event) => updateRange("startDate", event.target.value)}
							disabled={isExporting}
						/>
					</label>
					<label
						htmlFor="payment-export-end-date"
						className="grid gap-1.5 font-medium text-xs"
					>
						End date
						<Input
							id="payment-export-end-date"
							type="date"
							value={range.endDate}
							onChange={(event) => updateRange("endDate", event.target.value)}
							disabled={isExporting}
						/>
					</label>
				</div>

				{rangeError && (
					<p role="alert" className="text-destructive text-xs">
						{rangeError}
					</p>
				)}
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						disabled={isExporting}
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button type="button" disabled={isExporting} onClick={handleExport}>
						<IconDownload />

						{isExporting ? "Preparing…" : "Download CSV"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
