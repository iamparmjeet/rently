"use client";

import {
	FIXEDCHARGE,
	RATEPERUNIT,
} from "@rently/db/constants/payment-constants";
import { formatRupees, paiseToFormValue } from "@rently/ui/lib/currency";
import { ConfirmDialog } from "@rently/ui/shared/confirm-dialog";
import { FormDialog, useFormDialog } from "@rently/ui/shared/form-dialog";
import type {
	UtilityBatchFormValues,
	UtilityListItem,
} from "@rently/validators";
import { useState } from "react";
import { UtilityForm } from "@/components/forms/utility-form";
import { ActionsMenu } from "@/components/shared/action-menu";
import {
	useOptimisticRemoveUtility,
	useOptimisticUpdateUtility,
} from "@/hooks/utilities";
import { DiscountDialog } from "./discount-dialog";
import { UtilityCard } from "./utility-card";

interface UtilityCardActionsProps {
	utility: UtilityListItem;
	onMarkPaid?: () => void;
	onViewDetail?: () => void;
}

export function UtilityCardActions({
	utility,
	onMarkPaid,
	onViewDetail,
}: UtilityCardActionsProps) {
	const editDialog = useFormDialog();
	const deleteDialog = useFormDialog();
	const [discountOpen, setDiscountOpen] = useState(false);

	const updateUtility = useOptimisticUpdateUtility();
	const removeUtility = useOptimisticRemoveUtility();

	function handleEditSubmit(values: UtilityBatchFormValues) {
		const typeFields = (() => {
			if (utility.utilityType === "electricity" && values.electricity) {
				const { isPaid: _isPaid, ...rest } = values.electricity;
				return rest;
			}
			if (utility.utilityType === "water" && values.water) {
				const { isPaid: _isPaid, ...rest } = values.water;
				return rest;
			}
			if (utility.utilityType === "maintenance" && values.maintenance) {
				const { isPaid: _isPaid, ...rest } = values.maintenance;
				return rest;
			}
			return {} as const;
		})();

		updateUtility.mutate(
			{
				id: utility.id,
				data: {
					previousReadingDate: new Date(values.previousReadingDate),
					currentReadingDate: new Date(values.currentReadingDate),
					...typeFields,
				},
			},
			{ onSuccess: editDialog.closeDialog },
		);
	}

	function handleDelete() {
		removeUtility.mutate(
			{ id: utility.id },
			{ onSuccess: deleteDialog.closeDialog },
		);
	}

	function handleWhatsApp() {
		if (!utility.tenantPhone) return;
		const dateDisplay = new Date(utility.currentReadingDate).toLocaleDateString(
			"en-IN",
			{ day: "2-digit", month: "short", year: "numeric" },
		);
		const typeLabel =
			utility.utilityType === "electricity"
				? "electricity"
				: utility.utilityType === "water"
					? "water"
					: "maintenance";
		const amountDue =
			(utility as { amountDue?: number }).amountDue ?? utility.totalAmount;
		const message = encodeURIComponent(
			`Dear ${utility.tenantName ?? "Tenant"}, your ${typeLabel} bill for ${dateDisplay} is ${formatRupees(amountDue)}. Please pay at your earliest convenience. - KeyHQ`,
		);
		window.open(
			`https://wa.me/${utility.tenantPhone.replace(/\D/g, "")}?text=${message}`,
			"_blank",
		);
	}

	function handleEmail() {
		if (!utility.tenantEmail) return;
		const dateDisplay = new Date(utility.currentReadingDate).toLocaleDateString(
			"en-IN",
			{ day: "2-digit", month: "short", year: "numeric" },
		);
		const typeLabel =
			utility.utilityType === "electricity"
				? "Electricity Bill"
				: utility.utilityType === "water"
					? "Water Charge"
					: "Maintenance Charge";
		const amountDueEmail =
			(utility as { amountDue?: number }).amountDue ?? utility.totalAmount;
		window.open(
			`mailto:${utility.tenantEmail}?subject=${typeLabel} - ${dateDisplay}&body=Dear ${utility.tenantName ?? "Tenant"}, your bill is ${formatRupees(amountDueEmail)}.`,
		);
	}

	const defaultValues = buildEditDefaults(utility);

	return (
		<>
			<UtilityCard
				utility={utility}
				actionsSlot={
					<ActionsMenu
						onEdit={editDialog.openDialog}
						onDelete={deleteDialog.openDialog}
					/>
				}
				isDeleting={removeUtility.isPending}
				onWhatsApp={utility.tenantPhone ? handleWhatsApp : undefined}
				onEmail={utility.tenantEmail ? handleEmail : undefined}
				onMarkPaid={onMarkPaid}
				onDiscount={() => setDiscountOpen(true)}
				onViewDetail={onViewDetail}
			/>

			<FormDialog
				open={editDialog.open}
				onOpenChange={editDialog.onOpenChange}
				title="Edit utility charge"
				description="Update the billing period and charge details."
				formId="edit-utility-form"
				isSubmitting={updateUtility.isPending}
				submitLabel="Save Changes"
				size="lg"
			>
				<UtilityForm
					key={editDialog.open ? "open" : "closed"}
					leaseId={utility.leaseId}
					formId="edit-utility-form"
					defaultValues={defaultValues}
					onSubmit={handleEditSubmit}
					isSubmitting={updateUtility.isPending}
				/>
			</FormDialog>

			<ConfirmDialog
				open={deleteDialog.open}
				onOpenChange={deleteDialog.onOpenChange}
				title="Delete utility record?"
				description="This utility charge and its bill will be permanently deleted."
				confirmLabel="Delete"
				destructive
				onConfirm={handleDelete}
				isLoading={removeUtility.isPending}
			/>

			<DiscountDialog
				leaseId={utility.leaseId}
				utilityId={utility.id}
				open={discountOpen}
				onOpenChange={setDiscountOpen}
				amountDue={
					(utility as { amountDue?: number }).amountDue ?? utility.totalAmount
				}
				totalAmount={utility.totalAmount}
			/>
		</>
	);
}

function buildEditDefaults(
	u: UtilityListItem,
): Partial<UtilityBatchFormValues> {
	const base = {
		leaseId: u.leaseId,
		previousReadingDate: u.previousReadingDate
			? new Date(u.previousReadingDate).toISOString().split("T")[0]
			: new Date().toISOString().split("T")[0],
		currentReadingDate: u.currentReadingDate
			? new Date(u.currentReadingDate).toISOString().split("T")[0]
			: new Date().toISOString().split("T")[0],
	};

	if (u.utilityType === "electricity") {
		return {
			...base,
			electricity: {
				previousReading: Number(u.previousReading),
				currentReading: Number(u.currentReading),
				ratePerUnit: paiseToFormValue(u.ratePerUnit ?? RATEPERUNIT),
				fixedCharge: paiseToFormValue(u.fixedCharge ?? FIXEDCHARGE),
				isPaid: u.isPaid,
			},
		};
	}

	return {
		...base,
		[u.utilityType]: {
			fixedCharge: paiseToFormValue(u.fixedCharge ?? 0),
			description: u.description ?? undefined,
			isPaid: u.isPaid,
		},
	};
}
