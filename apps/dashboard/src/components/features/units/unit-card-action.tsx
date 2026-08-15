"use client";

import { ConfirmDialog } from "@rently/ui/shared/confirm-dialog";
import { FormDialog, useFormDialog } from "@rently/ui/shared/form-dialog";
import type { CreateUnit, UnitDetail } from "@rently/validators";
import { UnitForm } from "@/components/forms/unit-form";
import { ActionsMenu } from "@/components/shared/action-menu";
import { useDeleteUnit, useUpdateUnit } from "@/hooks/units";
import { UnitCard } from "./unit-card";

interface UnitCardActionsProps {
	unit: UnitDetail;
}

export function UnitCardActions({ unit }: UnitCardActionsProps) {
	const editDialog = useFormDialog();
	const deleteDialog = useFormDialog();

	const updateUnit = useUpdateUnit();
	const deleteUnit = useDeleteUnit();

	function handleEditSubmit(values: CreateUnit) {
		updateUnit.mutate(
			{ id: unit.id, data: values },
			{ onSuccess: editDialog.closeDialog },
		);
	}

	function handleDelete() {
		deleteUnit.mutate(
			{ id: unit.id },
			{
				onSuccess: deleteDialog.closeDialog,
				onError: deleteDialog.closeDialog,
			},
		);
	}

	return (
		<>
			<UnitCard
				unit={unit}
				actionsSlot={
					<ActionsMenu
						onEdit={editDialog.openDialog}
						onDelete={deleteDialog.openDialog}
					/>
				}
				isDeleting={deleteUnit.isPending}
			/>

			{/* ── Edit Dialog ── */}

			<FormDialog
				open={editDialog.open}
				onOpenChange={editDialog.onOpenChange}
				title={`Edit ${unit.unitNumber}`}
				formId="edit-unit-form"
				isSubmitting={updateUnit.isPending}
				submitLabel="Save Changes"
			>
				<UnitForm
					propertyId={unit.propertyId}
					formId="edit-unit-form" //  hides internal submit + sets form id
					defaultValues={{
						unitNumber: unit.unitNumber,
						baseRent: unit.baseRent,
						area: unit.area,
						description: unit.description,
						furnishing: getInitialFurnishing(unit.furnishing),
						type: unit.type,
					}}
					onSubmit={handleEditSubmit}
					isSubmitting={updateUnit.isPending}
				/>
			</FormDialog>

			<ConfirmDialog
				open={deleteDialog.open}
				onOpenChange={deleteDialog.onOpenChange}
				title="Delete Unit"
				description="This will permanently delete the unit and all its leases. This action cannot be undone."
				confirmLabel="Delete"
				destructive
				onConfirm={handleDelete}
				isLoading={deleteUnit.isPending}
			/>
		</>
	);
}

function getInitialFurnishing(value: string | null): CreateUnit["furnishing"] {
	if (
		value === "unfurnished" ||
		value === "semi_furnished" ||
		value === "fully_furnished"
	) {
		return value;
	}

	return "unfurnished";
}
