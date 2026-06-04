"use client";

import { zodResolver } from "@hookform/resolvers/zod";
// PAYMENT_METHODS is in payment-constants, PAYMENT_TYPES is in rent-constants
import { PAYMENT_METHOD_VALUES } from "@rently/db/constants/payment-constants";
import { PAYMENT_TYPES } from "@rently/db/constants/rent-constants";
import { Button } from "@rently/ui/components/button";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@rently/ui/components/field";
import { Input } from "@rently/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@rently/ui/components/select";
import { Textarea } from "@rently/ui/components/textarea";
import type { Lease } from "@rently/validators";
import { CreatePaymentSchema } from "@rently/validators";
import { Controller, useForm } from "react-hook-form";
import z from "zod";

// ── Form-layer schema ──
// The DB stores amount in paise (integer), but the form collects rupees
// We maintain a parallel form schema where `amount` is rupees (number),
// then convert on submit. This is the "anti-corruption layer" for monetary values.
const PaymentFormSchema = CreatePaymentSchema.extend({
	amount: z
		.number({ error: "Amount is required" })
		.positive({ error: "Amount must be greater than 0" }),
	// HTML date inputs return strings. We keep it as string in the form,
	// convert to Date on submit.
	paymentDate: z
		.string({ error: "Date is required" })
		.min(1, { error: "Date is required" }),
});

export type PaymentFormValues = z.infer<typeof PaymentFormSchema>;

interface PaymentFormProps {
	defaultValues?: Partial<PaymentFormValues>;
	onSubmit: (values: PaymentFormValues) => void;
	isSubmitting?: boolean;
	submitLabel?: string;
	formId?: string;
	leases: Pick<Lease, "id">[];
	leaseLabels: Record<string, string>;
}

export function PaymentForm({
	defaultValues,
	onSubmit,
	isSubmitting = false,
	submitLabel = "Record Payment",
	formId,
	leases,
	leaseLabels,
}: PaymentFormProps) {
	const {
		register,
		handleSubmit,
		control,
		watch,
		formState: { errors },
	} = useForm<PaymentFormValues>({
		resolver: zodResolver(PaymentFormSchema),
		defaultValues: {
			type: PAYMENT_TYPES.RENT,
			paymentDate: new Date().toISOString().split("T")[0],
			...defaultValues,
		},
	});

	const selectedType = watch("type");

	return (
		<form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-6">
			{/* ── Lease selection ──────── */}
			<FieldSet>
				<FieldLegend>Lease</FieldLegend>
				<FieldGroup className="flex flex-col gap-4">
					<Field data-invalid={!!errors.leaseId}>
						<FieldLabel htmlFor="leaseId">Lease</FieldLabel>
						<Controller
							name="leaseId"
							control={control}
							render={({ field }) => (
								<Select
									value={field.value ?? ""}
									onValueChange={field.onChange}
									disabled={isSubmitting || leases.length === 0}
								>
									<SelectTrigger id="leaseId">
										<SelectValue
											placeholder={
												leases.length === 0
													? "No active leases"
													: "Select a lease"
											}
										/>
									</SelectTrigger>
									<SelectContent>
										{leases.map((lease) => (
											<SelectItem key={lease.id} value={lease.id}>
												{leaseLabels[lease.id] ?? lease.id}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						/>
						<FieldError errors={[errors.leaseId]} />
					</Field>
				</FieldGroup>
			</FieldSet>

			{/* ── Payment details ──────────── */}
			<FieldSet>
				<FieldLegend>Payment Details</FieldLegend>
				<FieldGroup className="flex flex-col gap-4">
					{/* Amount — collects rupees, converted to paise by the parent on submit */}
					<Field data-invalid={!!errors.amount}>
						<FieldLabel htmlFor="amount">Amount (₹)</FieldLabel>
						<Input
							id="amount"
							type="number"
							min={1}
							step={1}
							placeholder="10000"
							disabled={isSubmitting}
							{...register("amount", { valueAsNumber: true })}
						/>
						<FieldError errors={[errors.amount]} />
					</Field>

					<Field data-invalid={!!errors.paymentDate}>
						<FieldLabel htmlFor="paymentDate">Payment Date</FieldLabel>
						<Input
							id="paymentDate"
							type="date"
							disabled={isSubmitting}
							{...register("paymentDate")}
						/>
						<FieldError errors={[errors.paymentDate]} />
					</Field>

					<Field data-invalid={!!errors.type}>
						<FieldLabel htmlFor="type">Payment Type</FieldLabel>
						<Controller
							name="type"
							control={control}
							render={({ field }) => (
								<Select
									value={selectedType ? field.value : ""}
									onValueChange={field.onChange}
									disabled={isSubmitting}
								>
									<SelectTrigger id="type">
										<SelectValue placeholder="Select type" />
									</SelectTrigger>
									<SelectContent>
										{Object.entries(PAYMENT_TYPES)
											// reversal is system-generated (voidPayment) — hide from manual entry
											.filter(([, value]) => value !== "reversal")
											.map(([_, value]) => (
												<SelectItem key={value} value={value}>
													<span className="capitalize">{value}</span>
												</SelectItem>
											))}
									</SelectContent>
								</Select>
							)}
						/>
						<FieldError errors={[errors.type]} />
					</Field>
				</FieldGroup>
			</FieldSet>

			{/* ── Method + Reference ───── */}
			<FieldSet>
				<FieldLegend>Payment Method</FieldLegend>
				<FieldGroup className="flex flex-col gap-4">
					<Field data-invalid={!!errors.paymentMethods}>
						<FieldLabel htmlFor="paymentMethods">Method (optional)</FieldLabel>
						<Controller
							name="paymentMethods"
							control={control}
							render={({ field }) => (
								<Select
									value={field.value ?? ""}
									onValueChange={field.onChange}
									disabled={isSubmitting}
								>
									<SelectTrigger id="paymentMethods">
										<SelectValue placeholder="How did they pay?" />
									</SelectTrigger>
									<SelectContent>
										{PAYMENT_METHOD_VALUES.map((method) => (
											<SelectItem key={method} value={method}>
												<span className="capitalize">
													{method.replace("_", " ")}
												</span>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						/>
						<FieldError errors={[errors.paymentMethods]} />
					</Field>

					<Field data-invalid={!!errors.referenceNumber}>
						<FieldLabel htmlFor="referenceNumber">
							Reference Number (optional)
						</FieldLabel>
						<Input
							id="referenceNumber"
							placeholder="UPI transaction ID, cheque number..."
							disabled={isSubmitting}
							{...register("referenceNumber")}
						/>
						<FieldError errors={[errors.referenceNumber]} />
					</Field>

					<Field data-invalid={!!errors.description}>
						<FieldLabel htmlFor="description">Notes (optional)</FieldLabel>
						<Textarea
							id="description"
							placeholder="Any notes about this payment..."
							disabled={isSubmitting}
							{...register("description")}
						/>
						<FieldError errors={[errors.description]} />
					</Field>
				</FieldGroup>
			</FieldSet>
			{!formId && (
				<Button type="submit" disabled={isSubmitting} className="w-full">
					{isSubmitting ? "Saving..." : submitLabel}
				</Button>
			)}
		</form>
	);
}
