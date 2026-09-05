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
import type { UtilityListItem } from "@rently/validators";
import { IconReceipt } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";
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
			const promises: Promise<unknown>[] = [];
			// Record rent if due
			if (rentDue > 0) {
				promises.push(
					client.rent.payment.createPayment({
						leaseId,
						amount: rentDue,
						paymentDate: new Date(values.receivedAt),
						type: "rent",
						paymentMethods: values.paymentMethod,
						description: values.notes ?? null,
						referenceNumber: null,
						utilityId: null,
					}),
				);
			}
			// Record each utility due
			for (const u of items) {
				const due = getDue(u);
				if (due <= 0) continue;
				promises.push(
					client.rent.utility.recordUtilityPayment({
						leaseId: u.leaseId,
						utilityId: u.id,
						amount: due,
						paymentMethod: values.paymentMethod,
						receivedAt: values.receivedAt,
						notes: values.notes,
					}),
				);
			}
			if (promises.length === 0) {
				toast.info("Nothing to record — all paid");
				onOpenChange(false);
				return;
			}
			await Promise.all(promises);
			toast.success(`Combined payment recorded — ${formatRupees(totalDue)}`);
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
						This will create {rentDue > 0 ? "1 rent" : "0 rent"} +{" "}
						{items.filter((u) => getDue(u) > 0).length} utility payment(s).
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
