"use client";

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
import { formatRupees } from "@rently/ui/lib/currency";
import { useIdempotencyKey } from "@rently/ui/shared/form-dialog";
import type { UtilityListItem } from "@rently/validators";
import { IconReceipt } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";
import { invalidatePeriodBalances } from "@/hooks/balance/use-period-balance";
import { client, orpc } from "@/utils/orpc";

const FormSchema = z.object({
	paymentMethod: z.enum(PAYMENT_METHOD_VALUES),
	receivedAt: z.string().min(1, { error: "Date required" }),
	notes: z.string().optional(),
});

type FormValues = z.infer<typeof FormSchema>;

export function MarkCombinedPaidDialog({
	items,
	rent,
	open,
	onOpenChange,
	onCompleted,
}: {
	items: UtilityListItem[];
	rent: number | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCompleted?: () => void;
}) {
	const queryClient = useQueryClient();
	const [isSubmitting, setIsSubmitting] = useState(false);
	// B11: one mutation for the whole combined bill, so one key per dialog open
	// (stable across retries, cleared on close) deduplicates the settlement.
	const idempotencyKey = useIdempotencyKey(open);

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<FormValues>({
		resolver: zodResolver(FormSchema),
		values: {
			paymentMethod: "cash",
			receivedAt: new Date().toISOString().split("T")[0] ?? "",
			notes: "",
		},
	});

	if (items.length === 0 && rent == null) return null;
	const first = items[0];
	const getDue = (u: UtilityListItem) =>
		(u as { amountDue?: number }).amountDue ?? u.totalAmount;
	const utilityDue = items.reduce((s, u) => {
		const d = getDue(u);
		return s + (d > 0 ? d : 0);
	}, 0);
	const rentDue = rent ?? 0;
	// For combined, rent is considered due if any utility is unpaid or always? Use rentDue as is when combined and not all paid
	const totalDue = utilityDue + rentDue;
	const hasDiscount = items.some((u) =>
		(u.credits ?? []).some((credit) => credit.type === "discount"),
	);

	async function onSubmit(values: FormValues) {
		if (items.length === 0) return;
		const leaseId = first?.leaseId;
		if (!leaseId) return;
		setIsSubmitting(true);
		try {
			// The server derives every allocation amount inside one atomic
			// settlement; the client only names the utility bills that still show
			// an outstanding balance and supplies payment metadata.
			const utilityIds = items.filter((u) => getDue(u) > 0).map((u) => u.id);
			const paymentDate = new Date(values.receivedAt);
			const description = values.notes ?? null;
			// Fallback only fires when closed (never submitted then).
			const key = idempotencyKey ?? crypto.randomUUID();

			let settledPaise = 0;
			if (utilityIds.length === 0) {
				// Every utility is already settled — the combined bill is
				// rent-only, which belongs to the single-payment command.
				const { payment } = await client.rent.payment.createPayment({
					leaseId,
					amount: rentDue,
					paymentDate,
					type: "rent",
					paymentMethods: values.paymentMethod,
					description,
					referenceNumber: null,
					utilityId: null,
					idempotencyKey: key,
				});
				settledPaise = payment.amount;
			} else {
				const { payments: allocations } =
					await client.rent.payment.createCombinedBillPayment({
						leaseId,
						utilityIds,
						paymentDate,
						paymentMethods: values.paymentMethod,
						description,
						referenceNumber: null,
						idempotencyKey: key,
					});
				settledPaise = allocations.reduce((s, p) => s + p.amount, 0);
			}
			toast.success(
				`Combined payment recorded — ${formatRupees(settledPaise)}`,
			);
			// Invalidate caches
			queryClient.invalidateQueries({
				queryKey: orpc.rent.utility.listUtilities.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.payment.listPayments.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.stats.getRevenueDashboard.key(),
			});
			invalidatePeriodBalances(queryClient);
			for (const u of items) {
				queryClient.invalidateQueries({
					queryKey: orpc.rent.utility.getUtilityById.key({
						input: { id: u.id },
					}),
				});
			}
			reset();
			onOpenChange(false);
			onCompleted?.();
		} catch (e) {
			toast.error(`Failed to record combined payment: ${(e as Error).message}`);
		} finally {
			setIsSubmitting(false);
		}
	}

	const utilityOriginal = items.reduce((s, u) => s + u.totalAmount, 0);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
						<IconReceipt className="size-5" />
					</div>
					<DialogTitle className="font-bold text-lg">
						Record combined payment
					</DialogTitle>
					<DialogDescription>
						{first?.tenantName ?? "Tenant"} · {first?.propertyName} · Unit{" "}
						{first?.unitNumber}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-2 rounded-xl border bg-muted/25 px-4 py-3">
					<div className="flex items-center justify-between">
						<span className="text-muted-foreground text-xs">Rent</span>
						<span className="font-semibold text-sm tabular-nums">
							{formatRupees(rentDue)}
						</span>
					</div>
					{items.map((u) => {
						const due = getDue(u);
						return (
							<div key={u.id} className="flex items-center justify-between">
								<span className="text-muted-foreground text-xs capitalize">
									{u.utilityType}
								</span>
								<span className="font-medium text-sm tabular-nums">
									{formatRupees(due)}
								</span>
							</div>
						);
					})}
					<div className="flex items-center justify-between border-t pt-2">
						<span className="font-semibold text-xs uppercase tracking-wide">
							Total due
						</span>
						<span className="font-bold text-lg tabular-nums">
							{formatRupees(totalDue)}
						</span>
					</div>
					{hasDiscount ? (
						<p className="text-muted-foreground text-xs line-through">
							Original {formatRupees(utilityOriginal + (rent ?? 0))}
						</p>
					) : null}
					<p className="text-muted-foreground text-xs">
						This records {rentDue > 0 ? "1 rent" : "0 rent"} +{" "}
						{items.filter((u) => getDue(u) > 0).length} utility payment(s) in
						one payment group.
					</p>
				</div>

				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<FieldSet>
						<FieldGroup className="space-y-4">
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
										placeholder="e.g. Combined rent + electricity"
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
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? "Saving..." : `Record ${formatRupees(totalDue)}`}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
