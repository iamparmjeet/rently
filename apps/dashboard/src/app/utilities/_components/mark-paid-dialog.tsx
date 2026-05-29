// ── Mark Paid Dialog ─

import { zodResolver } from "@hookform/resolvers/zod";
import { PAYMENT_METHOD_VALUES } from "@rently/db/constants/payment-constants";
import { Button } from "@rently/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@rently/ui/components/dialog";
import {
	Field,
	FieldContent,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldSet,
} from "@rently/ui/components/field";
import { Input } from "@rently/ui/components/input";
import {
	type RecordUtilityPayment,
	RecordUtilityPaymentSchema,
	type UtilityListItem,
} from "@rently/validators";
import { useForm } from "react-hook-form";
import { useRecordUtilityPayment } from "@/hooks/utilities";
import { formatRupees, paiseToFormValue, toPaise } from "@/lib/currency";

export function MarkPaidDialog({
	utility,
	open,
	onOpenChange,
}: {
	utility: UtilityListItem | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const recordPayment = useRecordUtilityPayment();

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<RecordUtilityPayment>({
		resolver: zodResolver(RecordUtilityPaymentSchema),
		// WHY `values` not `defaultValues`: `values` re-syncs when utility changes.
		// `defaultValues` only runs once on mount — the dialog reuses the component.
		values: utility
			? {
					utilityId: utility.id,
					leaseId: utility.leaseId,
					// Pre-fill with bill total in rupees — owner can edit for advance/partial
					amount: paiseToFormValue(utility.totalAmount),
					paymentMethod: "cash" as const,
					receivedAt: new Date().toISOString().split("T")[0] ?? "",
					notes: "",
				}
			: undefined,
	});

	function onSubmit(values: RecordUtilityPayment) {
		recordPayment.mutate(
			{
				...values,
				// WHY convert here: form is rupees, API expects paise
				amount: toPaise(values.amount),
			},
			{
				onSuccess: () => {
					reset();
					onOpenChange(false);
				},
			},
		);
	}

	if (!utility) return null;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle>Record Payment</DialogTitle>
					<DialogDescription>
						Bill total: {formatRupees(utility.totalAmount)} —{" "}
						{utility.unitNumber}
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<FieldSet>
						<FieldGroup className="space-y-4">
							<Field>
								<FieldLabel>Amount Received (₹)</FieldLabel>
								<FieldContent>
									<Input
										type="number"
										step="0.01"
										{...register("amount", { valueAsNumber: true })}
									/>
								</FieldContent>
								<FieldError errors={[errors.amount]} />
							</Field>

							<Field>
								<FieldLabel>Payment Method</FieldLabel>
								<FieldContent>
									<select
										className="w-full rounded-md border bg-background px-3 py-2 text-sm"
										{...register("paymentMethod")}
									>
										{PAYMENT_METHOD_VALUES.map((m) => (
											<option key={m} value={m}>
												{m.charAt(0).toUpperCase() +
													m.slice(1).replace("_", " ")}
											</option>
										))}
									</select>
								</FieldContent>
								<FieldError errors={[errors.paymentMethod]} />
							</Field>

							<Field>
								<FieldLabel>Date Received</FieldLabel>
								<FieldContent>
									<Input type="date" {...register("receivedAt")} />
								</FieldContent>
								<FieldError errors={[errors.receivedAt]} />
							</Field>

							<Field>
								<FieldLabel>Notes (optional)</FieldLabel>
								<FieldContent>
									<Input
										placeholder="e.g. Received by hand, advance payment..."
										{...register("notes", {
											setValueAs: (v) => (v === "" ? undefined : v),
										})}
									/>
								</FieldContent>
							</Field>
						</FieldGroup>
					</FieldSet>

					<Button
						type="submit"
						className="w-full"
						disabled={recordPayment.isPending}
					>
						{recordPayment.isPending ? "Saving..." : "Record Payment"}
					</Button>
				</form>
			</DialogContent>
		</Dialog>
	);
}
