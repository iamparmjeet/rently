// ── Mark Paid Dialog ─

import { zodResolver } from "@hookform/resolvers/zod";
import { PAYMENT_METHOD_VALUES } from "@rently/db/constants/payment-constants";
import { Button } from "@rently/ui/components/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
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
	formatRupees,
	paiseToFormValue,
	toPaise,
} from "@rently/ui/lib/currency";
import {
	type RecordUtilityPayment,
	RecordUtilityPaymentSchema,
	type UtilityListItem,
} from "@rently/validators";
import { IconReceipt } from "@tabler/icons-react";
import { useForm } from "react-hook-form";
import { useRecordUtilityPayment } from "@/hooks/utilities";

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
					// Pre-fill with amountDue (discounted) in rupees
					amount: paiseToFormValue(
						(utility as { amountDue?: number }).amountDue ??
							utility.totalAmount,
					),
					paymentMethod: "cash" as const,
					receivedAt: new Date().toISOString().split("T")[0] ?? "",
					notes: "",
				}
			: undefined,
	});

	function onSubmit(values: RecordUtilityPayment) {
		if (!utility) return;
		const amountInPaise = toPaise(values.amount);
		const expected =
			(utility as { amountDue?: number }).amountDue ?? utility.totalAmount;
		if (amountInPaise !== expected) {
			return;
		}

		recordPayment.mutate(
			{
				...values,
				// WHY convert here: form is rupees, API expects paise
				amount: amountInPaise,
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
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
						<IconReceipt className="size-5" />
					</div>
					<DialogTitle className="font-bold text-lg">
						Record utility payment
					</DialogTitle>
					<DialogDescription>
						{utility.tenantName ?? "Tenant"} · {utility.propertyName} · Unit{" "}
						{utility.unitNumber}
					</DialogDescription>
				</DialogHeader>
				{(() => {
					const amountDue =
						(utility as { amountDue?: number }).amountDue ??
						utility.totalAmount;
					const hasDiscount =
						(utility.credits ?? []).reduce(
							(sum, credit) => sum + credit.amount,
							0,
						) !== 0;
					return (
						<div className="flex items-center justify-between rounded-xl border bg-muted/25 px-4 py-3">
							<div>
								<p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
									{hasDiscount ? "Amount due" : "Bill amount"}
								</p>
								<p className="mt-1 text-muted-foreground text-xs capitalize">
									{utility.utilityType} · Unpaid
								</p>
								{hasDiscount ? (
									<p className="mt-1 text-muted-foreground text-xs line-through">
										Original {formatRupees(utility.totalAmount)}
									</p>
								) : null}
							</div>
							<p className="font-bold text-xl tabular-nums">
								{formatRupees(amountDue)}
							</p>
						</div>
					);
				})()}
				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<FieldSet>
						<FieldGroup className="space-y-4">
							<Field>
								<FieldLabel>Amount Received (₹)</FieldLabel>
								<FieldContent>
									<Input
										type="number"
										step="0.01"
										min="0.01"
										readOnly
										{...register("amount", { valueAsNumber: true })}
									/>
								</FieldContent>
								<FieldError errors={[errors.amount]} />
								{!errors.amount ? (
									<p className="text-muted-foreground text-xs">
										Record the full bill amount. Partial payments are not yet
										supported.
									</p>
								) : null}
							</Field>

							<Field>
								<FieldLabel>Payment Method</FieldLabel>
								<FieldContent>
									<select
										className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
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

					<DialogFooter>
						<DialogClose render={<Button variant="outline" />}>
							Cancel
						</DialogClose>
						<Button type="submit" disabled={recordPayment.isPending}>
							{recordPayment.isPending ? "Saving..." : "Record payment"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
