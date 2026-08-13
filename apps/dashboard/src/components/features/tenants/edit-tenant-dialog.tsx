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
import type { TenantDetail } from "@rently/validators";
import { useForm } from "react-hook-form";
import z from "zod";
import { useUpdateTenant } from "@/hooks/tenants";

// ── Form schema *************
const EditTenantFormSchema = z.object({
	phone: z.string().optional(),
	address: z.string().optional(),
});

type EditTenantFormValues = z.infer<typeof EditTenantFormSchema>;

interface EditTenantDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	tenant: TenantDetail;
}

export function EditTenantDialog({
	open,
	onOpenChange,
	tenant,
}: EditTenantDialogProps) {
	const updateTenant = useUpdateTenant();

	const form = useForm<EditTenantFormValues>({
		resolver: zodResolver(EditTenantFormSchema),
		// WHY `values` not `defaultValues`: `values` re-syncs whenever the prop
		// changes. Base UI Dialog keeps children mounted between opens.
		values: {
			phone: tenant.phone ?? "",
			address: tenant.profile?.address ?? "",
		},
	});

	function handleSubmit(values: EditTenantFormValues) {
		const { phone, address } = values;

		updateTenant.mutate(
			{
				tenantId: tenant.id,
				// WHY || undefined: empty string "" should not overwrite an existing
				// value; treat it as "not provided."
				phone: phone || undefined,
				address: address || undefined,
			},
			{ onSuccess: () => onOpenChange(false) },
		);
	}

	const isPending = updateTenant.isPending;

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
