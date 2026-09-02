"use client";

import { Button } from "@rently/ui/components/button";
import { Input } from "@rently/ui/components/input";
import { FormDialog, useFormDialog } from "@rently/ui/shared/form-dialog";
import { IconLayersIntersect } from "@tabler/icons-react";
import { useState } from "react";
import { useCreateCombinedLease } from "@/hooks/leases";
import { useSuspenseProperties } from "@/hooks/properties";
import { useSuspenseTenants } from "@/hooks/tenants";
import { useSuspenseUnits } from "@/hooks/units";

export function AddCombinedLeaseButton() {
	const dialog = useFormDialog();
	const mutation = useCreateCombinedLease();
	const { data: unitsData } = useSuspenseUnits();
	const { data: tenantsData } = useSuspenseTenants();
	const { data: propertiesData } = useSuspenseProperties();
	const [tenantId, setTenantId] = useState("");
	const [propertyId, setPropertyId] = useState("");
	const [selected, setSelected] = useState<string[]>([]);
	const [startDate, setStartDate] = useState(
		new Date().toISOString().slice(0, 10),
	);
	const [endDate, setEndDate] = useState("");

	const units = (unitsData.units ?? []).filter(
		(unit) =>
			unit.status === "available" &&
			(!propertyId || unit.propertyId === propertyId),
	);
	const canSubmit = !!tenantId && selected.length >= 2 && !!startDate;
	function reset() {
		setTenantId("");
		setPropertyId("");
		setSelected([]);
		setEndDate("");
	}
	function submit(event: React.FormEvent) {
		event.preventDefault();
		if (!canSubmit) return;
		mutation.mutate(
			{
				tenantId,
				startDate: new Date(startDate),
				endDate: endDate ? new Date(endDate) : undefined,
				units: selected.map((unitId) => ({
					unitId,
					rent: units.find((unit) => unit.id === unitId)?.baseRent ?? 0,
				})),
			},
			{
				onSuccess: () => {
					reset();
					dialog.closeDialog();
				},
			},
		);
	}

	return (
		<>
			<Button variant="outline" onClick={dialog.openDialog}>
				<IconLayersIntersect className="mr-2 size-4" />
				Combined Lease
			</Button>
			<FormDialog
				open={dialog.open}
				onOpenChange={dialog.onOpenChange}
				title="New Combined Lease"
				description="Place multiple available units under one tenant agreement."
				formId="combined-lease-form"
				isSubmitting={mutation.isPending}
				submitDisabled={!canSubmit}
				submitLabel="Create Combined Lease"
			>
				<form id="combined-lease-form" onSubmit={submit} className="space-y-4">
					<label className="block font-medium text-sm">
						Tenant
						<select
							value={tenantId}
							onChange={(event) => setTenantId(event.target.value)}
							className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
						>
							<option value="">Select tenant</option>
							{(tenantsData.tenants ?? []).map((tenant) => (
								<option key={tenant.id} value={tenant.id}>
									{tenant.name} · {tenant.email}
								</option>
							))}
						</select>
					</label>
					<label className="block font-medium text-sm">
						Property
						<select
							value={propertyId}
							onChange={(event) => {
								setPropertyId(event.target.value);
								setSelected([]);
							}}
							className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
						>
							<option value="">All properties</option>
							{(propertiesData.properties ?? []).map((property) => (
								<option key={property.id} value={property.id}>
									{property.name}
								</option>
							))}
						</select>
					</label>
					<div>
						<p className="mb-2 font-medium text-sm">
							Available units (select at least two)
						</p>
						<div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
							{units.map((unit) => (
								<label
									key={unit.id}
									className="flex items-center gap-2 text-sm"
								>
									<input
										type="checkbox"
										checked={selected.includes(unit.id)}
										onChange={(event) =>
											setSelected((current) =>
												event.target.checked
													? [...current, unit.id]
													: current.filter((id) => id !== unit.id),
											)
										}
									/>
									{unit.propertyName} · Unit {unit.unitNumber} · ₹
									{(unit.baseRent / 100).toLocaleString("en-IN")}
								</label>
							))}
							{units.length === 0 && (
								<p className="text-muted-foreground text-sm">
									No available units.
								</p>
							)}
						</div>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<label
							htmlFor="combined-start-date"
							className="font-medium text-sm"
						>
							Start date
							<Input
								id="combined-start-date"
								type="date"
								value={startDate}
								onChange={(event) => setStartDate(event.target.value)}
							/>
						</label>
						<label htmlFor="combined-end-date" className="font-medium text-sm">
							End date (optional)
							<Input
								id="combined-end-date"
								type="date"
								value={endDate}
								onChange={(event) => setEndDate(event.target.value)}
							/>
						</label>
					</div>
				</form>
			</FormDialog>
		</>
	);
}
