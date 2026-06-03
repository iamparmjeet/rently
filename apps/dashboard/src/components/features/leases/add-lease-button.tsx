import { Button } from "@rently/ui/components/button";
import { FormDialog, useFormDialog } from "@rently/ui/shared/form-dialog";
import { IconPlus } from "@tabler/icons-react";
import { LeaseForm, type LeaseFormValues } from "@/components/forms/lease-form";
import { useOptimisticCreateLease } from "@/hooks/leases";
import { useSuspenseProperties } from "@/hooks/properties";
import { useSuspenseTenants } from "@/hooks/tenants";
import { useSuspenseUnits } from "@/hooks/units";

interface AddLeaseButtonProps {
	unitId?: string;
	propertyId?: string;
	withIcon?: boolean;
	variant?: React.ComponentProps<typeof Button>["variant"];
}

export function AddLeaseButton({
	unitId,
	propertyId: propertyIdProp,
	withIcon,
	variant,
}: AddLeaseButtonProps) {
	const dialog = useFormDialog();
	const createLease = useOptimisticCreateLease();

	const { data: unitsData } = useSuspenseUnits();
	const { data: tenantsData } = useSuspenseTenants();
	const { data: propertiesData } = useSuspenseProperties();

	const allUnits = unitsData.units ?? [];

	const resolvedPropertyId =
		propertyIdProp ??
		(unitId ? allUnits.find((u) => u.id === unitId)?.propertyId : undefined);

	const unitOptions = (
		unitId
			? allUnits.filter((u) => u.id === unitId)
			: allUnits.filter((u) => u.status === "available")
	).map((u) => ({
		id: u.id,
		propertyId: u.propertyId,
		unitNumber: u.unitNumber,
		propertyName: u.propertyName ?? "",
		baseRent: u.baseRent,
	}));

	const tenantOptions = (tenantsData?.tenants ?? []).map((t) => ({
		id: t.id,
		name: t.name,
		email: t.email,
	}));

	const propertyOptions = (propertiesData?.properties ?? []).map((p) => ({
		id: p.id,
		name: p.name,
	}));

	function handleSubmit(values: LeaseFormValues) {
		createLease.mutate(
			{
				unitId: values.unitId,
				tenantId: values.tenantId,
				startDate: new Date(values.startDate),
				endDate: values.endDate ? new Date(values.endDate) : undefined,
				rent: values.rent,
				deposit: values.deposit,
			},
			{ onSuccess: dialog.closeDialog },
		);
	}

	return (
		<>
			<Button variant={variant} onClick={dialog.openDialog}>
				{withIcon && <IconPlus className="size-4" />}
				Add Lease
			</Button>
			<FormDialog
				open={dialog.open}
				onOpenChange={dialog.onOpenChange}
				title="Add Lease"
				formId="add-lease-form"
				isSubmitting={createLease.isPending}
				submitLabel="Add Lease"
			>
				<LeaseForm
					formId="add-lease-form"
					key={dialog.open ? "open" : "closed"}
					propertyId={resolvedPropertyId}
					properties={propertyOptions}
					units={unitOptions}
					tenants={tenantOptions}
					defaultValues={unitId ? { unitId } : undefined}
					onSubmit={handleSubmit}
					isSubmitting={createLease.isPending}
				/>
			</FormDialog>
		</>
	);
}
