"use client";
import { Button } from "@rently/ui/components/button";
import { FormDialog, useFormDialog } from "@rently/ui/shared/form-dialog";
import { IconPlus } from "@tabler/icons-react";
import {
	PropertyForm,
	type PropertyFormValues,
} from "@/components/forms/property-form";
import { useOptimisticCreateProperty } from "@/hooks/properties";

interface ActionButtonProps {
	withIcon?: boolean;
}

export default function PropertyActionButton({ withIcon }: ActionButtonProps) {
	const createProperty = useOptimisticCreateProperty();
	const addPropertyDialog = useFormDialog();

	function handleCreateProperty(values: PropertyFormValues) {
		createProperty.mutate(values, {
			onSuccess: () => addPropertyDialog.closeDialog(),
		});
	}
	return (
		<>
			<Button
				onClick={addPropertyDialog.openDialog}
				className="h-10 cursor-pointer"
			>
				{withIcon && <IconPlus className="size-4" />}
				Add Property
			</Button>
			<FormDialog
				open={addPropertyDialog.open}
				onOpenChange={addPropertyDialog.onOpenChange}
				title={"Add Property Details"}
				// description="Add the property details."
				formId="add-property-form"
				isSubmitting={createProperty.isPending}
				submitLabel="Add Property"
			>
				<PropertyForm
					key={addPropertyDialog.open ? "open" : "closed"}
					formId="add-property-form"
					onSubmit={handleCreateProperty}
					isSubmitting={createProperty.isPending}
				/>
			</FormDialog>
		</>
	);
}
