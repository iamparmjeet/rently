"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@rently/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@rently/ui/components/dialog";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldSet,
} from "@rently/ui/components/field";
import { Input } from "@rently/ui/components/input";
import { paiseToFormValue, toPaise } from "@rently/ui/lib/currency";
import type { Lease, TenantDetail } from "@rently/validators";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import z from "zod";
import { useUpdateLease } from "@/hooks/leases";
import { useUpdateTenant } from "@/hooks/tenants";
import { orpc } from "@/utils/orpc";

// ── Form schema *************
// WHY split schema: profile fields go to updateTenant, lease fields to updateLease.
// One form collects both — submission splits them into two sequential mutations.
const EditTenantFormSchema = z.object({
	phone: z.string().optional(),
	address: z.string().optional(),
	// Lease fields — only relevant when tenant has an active lease
	rent: z
		.number()
		.min(1)
		.optional()
		.or(z.nan().transform(() => undefined)),
	deposit: z.number().min(0).optional(),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
});

type EditTenantFormValues = z.infer<typeof EditTenantFormSchema>;

interface EditTenantDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	tenant: TenantDetail;
	lease: Lease | null | undefined;
}

export function EditTenantDialog({
	open,
	onOpenChange,
	tenant,
	lease,
}: EditTenantDialogProps) {
	const queryClient = useQueryClient();
	const updateTenant = useUpdateTenant();
	const updateLease = useUpdateLease();

	const form = useForm<EditTenantFormValues>({
		resolver: zodResolver(EditTenantFormSchema),
		// WHY `values` not `defaultValues`: `values` re-syncs whenever the prop
		// changes. Base UI Dialog keeps children mounted between opens, so without
		// this the form would show stale data if lease loads after dialog renders.
		values: {
			phone: tenant.phone ?? "",
			address: tenant.profile?.address ?? "",
			rent: lease ? paiseToFormValue(lease.rent) : undefined,
			deposit:
				lease?.deposit != null ? paiseToFormValue(lease.deposit) : undefined,
			startDate: lease?.startDate
				? new Date(lease.startDate).toISOString().split("T")[0]
				: undefined,
			endDate: lease?.endDate
				? new Date(lease.endDate).toISOString().split("T")[0]
				: undefined,
		},
	});

	function handleSubmit(values: EditTenantFormValues) {
		const { phone, address, rent, deposit, startDate, endDate } = values;

		updateTenant.mutate(
			{
				tenantId: tenant.id,
				// WHY || undefined: empty string "" should not overwrite an existing
				// value; treat it as "not provided."
				phone: phone || undefined,
				address: address || undefined,
			},
			{
				onSuccess: () => {
					const hasLeaseChanges =
						tenant.currentLease &&
						(rent != null || deposit != null || startDate || endDate);

					if (hasLeaseChanges && tenant.currentLease) {
						updateLease.mutate(
							{
								id: tenant.currentLease.id,
								data: {
									...(rent != null && { rent: toPaise(rent) }),
									...(deposit != null && { deposit: toPaise(deposit) }),
									...(startDate && { startDate: new Date(startDate) }),
									...(endDate && { endDate: new Date(endDate) }),
								},
							},
							{
								onSuccess: () => {
									// WHY manually invalidate: useUpdateLease doesn't know
									// about getTenantById. After updating lease.rent, the
									// stats bar would show stale data without this.
									queryClient.invalidateQueries({
										queryKey: orpc.rent.tenant.getTenantById.key({
											input: { id: tenant.id },
										}),
									});
									onOpenChange(false);
								},
							},
						);
					} else {
						onOpenChange(false);
					}
				},
			},
		);
	}

	const isPending = updateTenant.isPending || updateLease.isPending;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>Edit Tenant</DialogTitle>
				</DialogHeader>

				<form id="edit-tenant-form" onSubmit={form.handleSubmit(handleSubmit)}>
					{/******* Personal Details ******* */}
					<FieldSet className="space-y-4">
						<p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
							Personal Details
						</p>

						{/* WHY disabled: name + email live in Better Auth user table.
						    The owner cannot update them — only the tenant can, through
						    their own session. Changes go through the document request workflow. */}
						<FieldGroup className="grid grid-cols-2 gap-4">
							<Field>
								<FieldLabel>Full Name</FieldLabel>
								<Input value={tenant.name} disabled />
							</Field>
							<Field>
								<FieldLabel>Email</FieldLabel>
								<Input value={tenant.email} disabled />
							</Field>
						</FieldGroup>

						<FieldGroup className="grid grid-cols-2 gap-4">
							<Field>
								<FieldLabel>Phone</FieldLabel>
								<Input
									placeholder="+91 98765 43210"
									{...form.register("phone")}
								/>
								<FieldError>{form.formState.errors.phone?.message}</FieldError>
							</Field>
						</FieldGroup>

						<Field>
							<FieldLabel>Permanent Address</FieldLabel>
							<Input
								placeholder="Permanent home address..."
								{...form.register("address")}
							/>
						</Field>
					</FieldSet>

					<div className="my-6 border-t" />

					{/* ── Rental Details ────────────────────────────────────── */}
					<FieldSet className="space-y-4">
						<p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
							Rental Details
						</p>

						{tenant.currentLease ? (
							<>
								{/* WHY disabled: changing property/unit requires creating a
								    new lease (different unit, different contract). These
								    are immutable on an existing lease. */}
								<FieldGroup className="grid grid-cols-2 gap-4">
									<Field>
										<FieldLabel>Property</FieldLabel>
										<Input value={tenant.currentLease.propertyName} disabled />
									</Field>
									<Field>
										<FieldLabel>Unit</FieldLabel>
										<Input value={tenant.currentLease.unitNumber} disabled />
									</Field>
								</FieldGroup>

								<FieldGroup className="grid grid-cols-2 gap-4">
									<Field>
										<FieldLabel>Monthly Rent (₹)</FieldLabel>
										<Input
											type="number"
											min={1}
											step={100}
											{...form.register("rent", { valueAsNumber: true })}
										/>
										<FieldError>
											{form.formState.errors.rent?.message}
										</FieldError>
									</Field>
									<Field>
										<FieldLabel>Security Deposit (₹)</FieldLabel>
										<Input
											type="number"
											min={0}
											step={100}
											{...form.register("deposit", { valueAsNumber: true })}
										/>
									</Field>
								</FieldGroup>

								<FieldGroup className="grid grid-cols-2 gap-4">
									<Field>
										<FieldLabel>Lease Start</FieldLabel>
										<Input type="date" {...form.register("startDate")} />
									</Field>
									<Field>
										<FieldLabel>Lease End</FieldLabel>
										<Input type="date" {...form.register("endDate")} />
									</Field>
								</FieldGroup>
							</>
						) : (
							<p className="rounded-md border border-dashed px-4 py-6 text-center text-muted-foreground text-sm">
								No active lease — rental details cannot be edited.
							</p>
						)}
					</FieldSet>
				</form>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isPending}
					>
						Cancel
					</Button>
					<Button type="submit" form="edit-tenant-form" disabled={isPending}>
						{isPending ? "Saving..." : "Save Changes"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
