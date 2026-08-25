"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
	APPLIED_AS_VALUES,
	CREDIT_TYPE_VALUES,
} from "@rently/db/constants/payment-constants";
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
import { Textarea } from "@rently/ui/components/textarea";
import { formatRupees } from "@rently/ui/lib/currency";
import { IconTag } from "@tabler/icons-react";
import { useForm } from "react-hook-form";
import z from "zod";
import { useCreateCredit } from "@/hooks/credit";

const FormSchema = z.object({
	amountRupees: z.number().min(0.01, { error: "Amount >= ₹0.01" }),
	reason: z.string().min(10, { error: "Reason >= 10 chars" }).trim(),
	type: z.enum(CREDIT_TYPE_VALUES),
	appliedAs: z.enum(APPLIED_AS_VALUES),
});

type FormValues = z.infer<typeof FormSchema>;

export function DiscountDialog({
	leaseId,
	utilityId,
	open,
	onOpenChange,
	amountDue,
	totalAmount,
}: {
	leaseId: string;
	utilityId?: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	amountDue?: number;
	totalAmount?: number;
}) {
	const createCredit = useCreateCredit();

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<FormValues>({
		resolver: zodResolver(FormSchema),
		values: {
			amountRupees: 0,
			reason: "",
			type: "discount",
			appliedAs: "adjust",
		},
	});

	function onSubmit(values: FormValues) {
		const amountPaise = -Math.round(values.amountRupees * 100);
		createCredit.mutate(
			{
				leaseId,
				utilityId: utilityId ?? null,
				type: values.type,
				amount: amountPaise,
				reason: values.reason,
				appliedAs: values.appliedAs,
			},
			{
				onSuccess: () => {
					reset();
					onOpenChange(false);
				},
			},
		);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
						<IconTag className="size-5" />
					</div>
					<DialogTitle className="font-bold text-lg">
						Add discount / write-off
					</DialogTitle>
					<DialogDescription>
						{utilityId ? "Utility bill" : "Rent"} · Credit note KQ-CN-xxx
						generated automatically. Amount is stored as negative paise.
					</DialogDescription>
				</DialogHeader>

				{amountDue !== undefined && totalAmount !== undefined ? (
					<div className="flex items-center justify-between rounded-xl border bg-muted/25 px-4 py-3">
						<div>
							<p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
								Amount due
							</p>
							<p className="mt-1 text-muted-foreground text-xs">
								Original {formatRupees(totalAmount)}
							</p>
						</div>
						<p className="font-bold text-xl tabular-nums">
							{formatRupees(amountDue)}
						</p>
					</div>
				) : null}

				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<FieldSet>
						<FieldGroup className="space-y-4">
							<Field>
								<FieldLabel>Amount (₹)</FieldLabel>
								<FieldContent>
									<Input
										type="number"
										step="0.01"
										min="0.01"
										placeholder="e.g. 500.00"
										{...register("amountRupees", { valueAsNumber: true })}
									/>
								</FieldContent>
								<FieldError errors={[errors.amountRupees]} />
								<p className="text-muted-foreground text-xs">
									Enter discount in rupees; stored as negative paise. Must not
									exceed amount due.
								</p>
							</Field>

							<Field>
								<FieldLabel>Reason (≥10 chars)</FieldLabel>
								<FieldContent>
									<Textarea
										placeholder="e.g. Good tenant discount for early payment"
										{...register("reason")}
									/>
								</FieldContent>
								<FieldError errors={[errors.reason]} />
							</Field>

							<div className="grid grid-cols-2 gap-4">
								<Field>
									<FieldLabel>Type</FieldLabel>
									<FieldContent>
										<select
											className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
											{...register("type")}
										>
											{CREDIT_TYPE_VALUES.map((t) => (
												<option key={t} value={t}>
													{t.replaceAll("_", " ")}
												</option>
											))}
										</select>
									</FieldContent>
									<FieldError errors={[errors.type]} />
								</Field>

								<Field>
									<FieldLabel>Applied as</FieldLabel>
									<FieldContent>
										<select
											className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
											{...register("appliedAs")}
										>
											{APPLIED_AS_VALUES.map((a) => (
												<option key={a} value={a}>
													{a === "adjust"
														? "Adjust in next bill"
														: "Refund (cash back)"}
												</option>
											))}
										</select>
									</FieldContent>
									<FieldError errors={[errors.appliedAs]} />
								</Field>
							</div>
						</FieldGroup>
					</FieldSet>

					<DialogFooter>
						<DialogClose render={<Button variant="outline" />}>
							Cancel
						</DialogClose>
						<Button type="submit" disabled={createCredit.isPending}>
							{createCredit.isPending ? "Saving..." : "Create credit note"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
