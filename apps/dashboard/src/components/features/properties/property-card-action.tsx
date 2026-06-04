"use client";

import { ConfirmDialog } from "@rently/ui/shared/confirm-dialog";
import { FormDialog, useFormDialog } from "@rently/ui/shared/form-dialog";
import type { PropertyWithStats } from "@rently/validators";

import { PropertyCard } from "@/components/features/properties";
import {
	PropertyForm,
	type PropertyFormValues,
} from "@/components/forms/property-form";
import { ActionsMenu } from "@/components/shared/action-menu";
import { useDeleteProperty, useUpdateProperty } from "@/hooks/properties";

interface PropertyCardActionsProps {
	property: PropertyWithStats;
}

export function PropertyCardActions({ property }: PropertyCardActionsProps) {
	const editDialog = useFormDialog();
	const deleteDialog = useFormDialog();

	const updateProperty = useUpdateProperty();
	const deleteProperty = useDeleteProperty();

	function handleEditSubmit(values: PropertyFormValues) {
		updateProperty.mutate(
			{ id: property.id, data: values },
			{ onSuccess: editDialog.closeDialog },
		);
	}

	function handleDelete() {
		deleteProperty.mutate(
			{ id: property.id },
			{ onSuccess: deleteDialog.closeDialog },
		);
	}

	return (
		<>
			<PropertyCard
				property={property}
				actionsSlot={
					<ActionsMenu
						onEdit={editDialog.openDialog}
						onDelete={deleteDialog.openDialog}
					/>
				}
				isDeleting={deleteProperty.isPending}
			/>

			{/* ── Edit Dialog ── */}

			<FormDialog
				open={editDialog.open}
				onOpenChange={editDialog.onOpenChange}
				title={`Edit ${property.name}`}
				formId="edit-property-form"
				isSubmitting={updateProperty.isPending}
				submitLabel="Save Changes"
			>
				<PropertyForm
					formId="edit-property-form" //  hides internal submit + sets form id
					defaultValues={{
						name: property.name,
						address: property.address,
						type: property.type,
						description: property.description,
						floors: property.floors,
						totalArea: property.totalArea,
						yearBuilt: property.yearBuilt,
					}}
					onSubmit={handleEditSubmit}
					isSubmitting={updateProperty.isPending}
				/>
			</FormDialog>

			<ConfirmDialog
				open={deleteDialog.open}
				onOpenChange={deleteDialog.onOpenChange}
				title="Delete Property"
				description="This will permanently delete the property and all its units. This action cannot be undone."
				confirmLabel="Delete"
				destructive
				onConfirm={handleDelete}
				isLoading={deleteProperty.isPending}
			/>
		</>
	);
}
