import { Button } from "@rently/ui/components/button";
import { FormDialog, useFormDialog } from "@rently/ui/shared/form-dialog";
import type { CreateUnit } from "@rently/validators";
import { IconPlus } from "@tabler/icons-react";
import { UnitForm } from "@/components/forms/unit-form";
import { useSuspenseProperties } from "@/hooks/properties";
import { useCreateUnit } from "@/hooks/units";

interface AddUnitButtonProps {
	propertyId?: string;
	withIcon?: boolean;
	variant?: React.ComponentProps<typeof Button>["variant"];
}

export function AddUnitButton({
	propertyId,
	withIcon,
	variant,
}: AddUnitButtonProps) {
	const dialog = useFormDialog();
	const createUnit = useCreateUnit();

	const { data } = useSuspenseProperties();
	const properties = propertyId ? [] : (data?.properties ?? []);

	function handleSubmit(values: CreateUnit) {
		createUnit.mutate(values, { onSuccess: dialog.closeDialog });
	}

	return (
		<>
			<Button variant={variant} onClick={dialog.openDialog}>
				{withIcon && <IconPlus className="size-4" />}
				Add Unit
			</Button>
			<FormDialog
				open={dialog.open}
				onOpenChange={dialog.onOpenChange}
				title="Add Unit"
				formId="add-unit-form"
				isSubmitting={createUnit.isPending}
				submitLabel="Add Unit"
			>
				<UnitForm
					formId="add-unit-form"
					key={dialog.open ? "open" : "closed"}
					propertyId={propertyId}
					properties={properties}
					onSubmit={handleSubmit}
					isSubmitting={createUnit.isPending}
				/>
			</FormDialog>
		</>
	);
}
