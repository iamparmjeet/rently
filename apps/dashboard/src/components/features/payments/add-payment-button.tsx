"use client";

// apps/dashboard/src/components/features/payments/add-payment-button.tsx
import { Button } from "@rently/ui/components/button";
import { toPaise } from "@rently/ui/lib/currency";
import {
	FormDialog,
	useFormDialog,
	useIdempotencyKey,
} from "@rently/ui/shared/form-dialog";
import { IconPlus } from "@tabler/icons-react";
import { useMemo } from "react";
import {
	PaymentForm,
	type PaymentFormValues,
} from "@/components/forms/payment-form";
import { useLeases } from "@/hooks/leases";
import { useRecordPayment } from "@/hooks/payments";
import { entityLabel } from "@/utils/display";

interface AddPaymentButtonProps {
	//  optional leaseId — when injected (e.g. from lease detail page),
	//      the lease selector is pre-filled and the fetch for all active leases
	//      is still called but the result is filtered to the single lease.
	//      Same pattern as AddUnitButton's optional propertyId.
	leaseId?: string;
	/** Restrict the lease selector to a tenant's active leases. */
	leaseIds?: string[];
	withIcon?: boolean;
	variant?: React.ComponentProps<typeof Button>["variant"];
}

export function AddPaymentButton({
	leaseId,
	leaseIds,
	withIcon,
	variant,
}: AddPaymentButtonProps) {
	const dialog = useFormDialog();
	const recordPayment = useRecordPayment();
	// B07: one key per dialog open — retries resubmit the same key.
	const idempotencyKey = useIdempotencyKey(dialog.open);

	const { data: leasesData } = useLeases("active");
	const activeLeases = leasesData?.leases ?? [];
	const selectableLeases = useMemo(
		() =>
			leaseIds
				? activeLeases.filter((lease) => leaseIds.includes(lease.leaseId))
				: activeLeases,
		[activeLeases, leaseIds],
	);

	// ── Derived data for the form ───
	const leaseList = useMemo(() => {
		// When a leaseId is pre-injected, we only show that one lease.
		// The fetch still runs (no conditional hook) but we scope the options.
		if (leaseId) return [{ id: leaseId }];
		// LeaseWithDetails uses `leaseId` (not `id`) — map explicitly.
		return selectableLeases.map((l) => ({ id: l.leaseId }));
	}, [leaseId, selectableLeases]);

	const leaseLabels = useMemo(() => {
		if (leaseId) {
			// Find the matching lease for a label, fall back to the raw ID
			const match = selectableLeases.find((l) => l.leaseId === leaseId);
			const label = match
				? `${entityLabel(match.unitNumber, match.unitId)} – ${match.tenantName ? entityLabel(match.tenantName, match.tenantId) : "Unknown"} · ${entityLabel(match.propertyName, match.propertyId)} · Lease-${leaseId.slice(-6).toUpperCase()}`
				: entityLabel("Lease", leaseId);
			return { [leaseId]: label };
		}
		return Object.fromEntries(
			selectableLeases.map((l) => [
				l.leaseId,
				// Format: "Unit 101 – Amandeep Singh · Green Valley Apartments"
				`${entityLabel(l.unitNumber, l.unitId)} – ${l.tenantName ? entityLabel(l.tenantName, l.tenantId) : "Unknown"} · ${entityLabel(l.propertyName, l.propertyId)} · Lease-${l.leaseId.slice(-6).toUpperCase()}`,
			]),
		);
	}, [leaseId, selectableLeases]);

	// ── Submit handler ──────
	function handleSubmit(values: PaymentFormValues) {
		recordPayment.mutate(
			{
				...values,
				// Anti-corruption layer — form collects rupees, API expects paise.
				// toPaise does Math.round(rupees * 100) to avoid floating-point drift.
				amount: toPaise(values.amount),
				// HTML date input gives a string; API expects a Date object.
				paymentDate: new Date(values.paymentDate),
				// Normalize empty strings to null for optional DB columns.
				// An empty string "" is not the same as NULL in PostgreSQL.
				referenceNumber: values.referenceNumber || null,
				description: values.description || null,
				utilityId: values.utilityId || null,
				paymentMethods: values.paymentMethods ?? null,
				// Fallback only fires when closed (never submitted then).
				idempotencyKey: idempotencyKey ?? crypto.randomUUID(),
			},
			{ onSuccess: dialog.closeDialog },
		);
	}

	return (
		<>
			<Button variant={variant} onClick={dialog.openDialog}>
				{withIcon && <IconPlus className="size-4" />}
				Record Payment
			</Button>

			<FormDialog
				open={dialog.open}
				onOpenChange={dialog.onOpenChange}
				title="Record Payment"
				description="Record a rent, deposit, or utility payment received."
				formId="add-payment-form"
				isSubmitting={recordPayment.isPending}
				submitLabel="Record Payment"
			>
				{/* key resets form state on close — Base UI Dialog keeps children mounted between opens, so without this the previous values persist. */}
				<PaymentForm
					key={dialog.open ? "open" : "closed"}
					formId="add-payment-form"
					leases={leaseList}
					leaseLabels={leaseLabels}
					defaultValues={leaseId ? { leaseId } : undefined}
					onSubmit={handleSubmit}
					isSubmitting={recordPayment.isPending}
				/>
			</FormDialog>
		</>
	);
}
