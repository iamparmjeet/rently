"use client";

import { PAYMENT_METHOD_VALUES } from "@rently/db/constants/payment-constants";
import { Button } from "@rently/ui/components/button";
import { Input } from "@rently/ui/components/input";
import { FormDialog, useFormDialog } from "@rently/ui/shared/form-dialog";
import { IconLayersIntersect } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useLeases } from "@/hooks/leases";
import { useRecordAgreementPayment } from "@/hooks/payments";

export function AddAgreementPaymentButton() {
	const dialog = useFormDialog();
	const { data } = useLeases("active");
	const mutation = useRecordAgreementPayment();
	const groups = useMemo(() => {
		const grouped = new Map<
			string,
			{ agreementId: string; label: string; count: number }
		>();
		for (const lease of data?.leases ?? []) {
			if (!lease.agreementId) continue;
			const current = grouped.get(lease.agreementId);
			grouped.set(lease.agreementId, {
				agreementId: lease.agreementId,
				label:
					current?.label ??
					`${lease.propertyName} · ${lease.tenantName ?? "Tenant"}`,
				count: (current?.count ?? 0) + 1,
			});
		}
		return [...grouped.values()].filter((group) => group.count > 1);
	}, [data?.leases]);
	const [agreementId, setAgreementId] = useState("");
	const [paymentDate, setPaymentDate] = useState(
		new Date().toISOString().slice(0, 10),
	);
	const [paymentMethods, setPaymentMethods] = useState("");
	const [referenceNumber, setReferenceNumber] = useState("");
	const canSubmit = !!agreementId && !!paymentDate;
	function submit(event: React.FormEvent) {
		event.preventDefault();
		if (!canSubmit) return;
		mutation.mutate(
			{
				agreementId,
				paymentDate: new Date(paymentDate),
				paymentMethods: paymentMethods ? (paymentMethods as never) : null,
				referenceNumber: referenceNumber || null,
				description: null,
			},
			{ onSuccess: () => dialog.closeDialog() },
		);
	}
	return (
		<>
			<Button
				variant="outline"
				disabled={groups.length === 0}
				onClick={dialog.openDialog}
			>
				<IconLayersIntersect className="mr-2 size-4" />
				Combined Payment
			</Button>
			<FormDialog
				open={dialog.open}
				onOpenChange={dialog.onOpenChange}
				title="Record Combined Payment"
				description="This settles the outstanding rent balance for every active unit in the agreement."
				formId="combined-payment-form"
				isSubmitting={mutation.isPending}
				submitDisabled={!canSubmit}
				submitLabel="Record Payment"
			>
				<form
					id="combined-payment-form"
					onSubmit={submit}
					className="space-y-4"
				>
					<label
						htmlFor="combined-payment-date"
						className="block font-medium text-sm"
					>
						Agreement
						<select
							value={agreementId}
							onChange={(event) => setAgreementId(event.target.value)}
							className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
						>
							<option value="">Select agreement</option>
							{groups.map((group) => (
								<option key={group.agreementId} value={group.agreementId}>
									{group.label} · {group.count} units
								</option>
							))}
						</select>
					</label>
					<label
						htmlFor="combined-payment-date"
						className="block font-medium text-sm"
					>
						Payment date
						<Input
							id="combined-payment-date"
							type="date"
							value={paymentDate}
							onChange={(event) => setPaymentDate(event.target.value)}
						/>
					</label>
					<label className="block font-medium text-sm">
						Method
						<select
							value={paymentMethods}
							onChange={(event) => setPaymentMethods(event.target.value)}
							className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
						>
							<option value="">Not provided</option>
							{PAYMENT_METHOD_VALUES.map((method) => (
								<option key={method} value={method}>
									{method.replaceAll("_", " ")}
								</option>
							))}
						</select>
					</label>
					<label
						htmlFor="combined-payment-reference"
						className="block font-medium text-sm"
					>
						Reference (optional)
						<Input
							id="combined-payment-reference"
							value={referenceNumber}
							onChange={(event) => setReferenceNumber(event.target.value)}
						/>
					</label>
				</form>
			</FormDialog>
		</>
	);
}
