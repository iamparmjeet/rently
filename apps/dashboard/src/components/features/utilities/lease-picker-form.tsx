// apps/dashboard/src/components/features/utilities/lease-picker-form.tsx
"use client";

import { Field, FieldLabel } from "@rently/ui/components/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@rently/ui/components/select";
import { formatRupees } from "@rently/ui/lib/currency";
import type {
	LeaseWithDetails,
	UtilityBatchFormValues,
} from "@rently/validators";
import { IconChevronRight, IconHome } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { UtilityForm } from "@/components/forms/utility-form";
import { entityLabel } from "@/utils/display";

// ── Types ─────────────────────────────────────────────────────────────────────

type UtilityType = "electricity" | "water" | "maintenance";

interface UnitPickerUtilityFormProps {
	leases: LeaseWithDetails[];
	onSubmit: (values: UtilityBatchFormValues) => void;
	isSubmitting: boolean;
	// WHY: which tab the user clicked "Add" from — pre-toggles the right section
	initialType?: UtilityType;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function UnitPickerUtilityForm({
	leases,
	onSubmit,
	isSubmitting,
	initialType,
}: UnitPickerUtilityFormProps) {
	const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
		null,
	);
	const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);

	// WHY: only active leases — you cannot add a utility bill to a
	// terminated or expired lease. Filtering here means the picker
	// never shows irrelevant units.
	const activeLeases = useMemo(
		() => leases.filter((l) => l.status === "active"),
		[leases],
	);

	// Derive unique properties from active leases — no separate fetch needed.
	// The JOIN data is already in memory from useSuspenseLeases().
	const properties = useMemo(() => {
		const seen = new Set<string>();
		return activeLeases
			.filter((l) => {
				if (seen.has(l.propertyId)) return false;
				seen.add(l.propertyId);
				return true;
			})
			.map((l) => ({ id: l.propertyId, name: l.propertyName }));
	}, [activeLeases]);

	// Units visible after a property is selected — each "unit" is its active lease
	const propertyLeases = useMemo(
		() =>
			selectedPropertyId
				? activeLeases.filter((l) => l.propertyId === selectedPropertyId)
				: [],
		[activeLeases, selectedPropertyId],
	);

	// ── Step 3: show the utility form once a lease is resolved ───────────────
	if (selectedLeaseId) {
		return (
			<UtilityForm
				leaseId={selectedLeaseId}
				initialType={initialType}
				onSubmit={onSubmit}
				isSubmitting={isSubmitting}
			/>
		);
	}

	// ── Steps 1 + 2: property → unit picker ──────────────────────────────────
	if (activeLeases.length === 0) {
		return (
			<p className="rounded-md border border-dashed px-4 py-8 text-center text-muted-foreground text-sm">
				No active leases found. Add a lease before recording utilities.
			</p>
		);
	}

	return (
		<div className="space-y-4">
			{/* Step 1 — Property */}
			<Field>
				<FieldLabel>Property</FieldLabel>
				<Select
					value={selectedPropertyId ?? ""}
					onValueChange={(v) => {
						setSelectedPropertyId(v);
						setSelectedLeaseId(null);
					}}
				>
					<SelectTrigger>
						<SelectValue placeholder="Select a property">
							{selectedPropertyId
								? entityLabel(
										properties.find((p) => p.id === selectedPropertyId)?.name ??
											"",
										selectedPropertyId,
									)
								: undefined}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						{properties.map((p) => (
							<SelectItem key={p.id} value={p.id}>
								{entityLabel(p.name, p.id)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</Field>

			{/* Step 2 — Unit cards (only after property selected) */}
			{selectedPropertyId && (
				<Field>
					<FieldLabel>Unit</FieldLabel>
					{propertyLeases.length === 0 ? (
						<p className="rounded-md border border-dashed px-3 py-6 text-center text-muted-foreground text-sm">
							No active leases for this property
						</p>
					) : (
						<div className="max-h-52 space-y-2 overflow-y-auto pr-1">
							{propertyLeases.map((lease) => (
								<LeaseUnitCard
									key={lease.leaseId}
									lease={lease}
									onSelect={() => setSelectedLeaseId(lease.leaseId)}
								/>
							))}
						</div>
					)}
				</Field>
			)}
		</div>
	);
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function LeaseUnitCard({
	lease,
	onSelect,
}: {
	lease: LeaseWithDetails;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onSelect}
			className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all hover:border-primary/40 hover:bg-muted/40"
		>
			<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
				<IconHome className="size-4 text-muted-foreground" />
			</div>
			<div className="min-w-0 flex-1">
				<p className="font-medium text-sm">
					{entityLabel(lease.unitNumber, lease.unitId)}
				</p>
				<p className="text-muted-foreground text-xs">
					{lease.tenantName
						? entityLabel(lease.tenantName, lease.tenantId)
						: "—"}{" "}
					· {formatRupees(lease.rent)}/mo
				</p>
			</div>
			<IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
		</button>
	);
}
