"use client";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@rently/ui/components/dropdown-menu";
import { ConfirmDialog } from "@rently/ui/shared/confirm-dialog";
import { FormDialog } from "@rently/ui/shared/form-dialog";
import type { PropertyWithStats } from "@rently/validators";
import { IconDots, IconPencil, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { PropertyCard } from "@/components/features/properties";
import {
	PropertyForm,
	type PropertyFormValues,
} from "@/components/forms/property-form";
import { useDeleteProperty, useUpdateProperty } from "@/hooks/properties";

interface PropertyCardActionsProps {
	property: PropertyWithStats;
}

export function PropertyCardActions({ property }: PropertyCardActionsProps) {
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);

	const updateProperty = useUpdateProperty();
	const deleteProperty = useDeleteProperty();

	function handleEditSubmit(values: PropertyFormValues) {
		updateProperty.mutate(
			{ id: property.id, data: values },
			{ onSuccess: () => setIsEditOpen(false) },
		);
	}

	function handleDelete() {
		deleteProperty.mutate(
			{ id: property.id },
			{ onSuccess: () => setIsDeleteOpen(false) },
		);
	}

	const actionsSlot = (
		<DropdownMenu>
			<DropdownMenuTrigger>
				<IconDots className="size-4 rotate-90" />
				<span className="sr-only">Open menu</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem
					className="cursor-pointer"
					onClick={() => setIsEditOpen(true)}
				>
					<IconPencil className="mr-2 size-4" />
					Edit
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					className="text-destructive focus:text-destructive"
					// disabled={deleteProperty.isPending}
					onClick={() => setIsDeleteOpen(true)}
				>
					<IconTrash className="mr-2 size-4" />
					Delete
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);

	return (
		<>
			<PropertyCard
				property={property}
				actionsSlot={actionsSlot}
				isDeleting={deleteProperty.isPending}
			/>

			{/* ── Edit Dialog ── */}

			<FormDialog
				open={isEditOpen}
				onOpenChange={setIsEditOpen}
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
				open={isDeleteOpen}
				onOpenChange={setIsDeleteOpen}
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
