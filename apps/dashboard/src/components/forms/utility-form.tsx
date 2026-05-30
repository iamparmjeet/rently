// apps/web/src/components/forms/utility-form.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
	FIXEDCHARGE,
	RATEPERUNIT,
} from "@rently/db/constants/payment-constants";
import { generatedId } from "@rently/db/utils/id";
import { Button } from "@rently/ui/components/button";
import {
	Field,
	FieldContent,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@rently/ui/components/field";
import { Input } from "@rently/ui/components/input";
import { Switch } from "@rently/ui/components/switch";
import { paiseToFormValue } from "@rently/ui/lib/currency";
import {
	type FixedCharge,
	type MeterReading,
	UtilityBatchFormSchema,
	type UtilityBatchFormValues,
} from "@rently/validators";
import { useForm } from "react-hook-form";

interface UtilityFormProps {
	defaultValues?: Partial<UtilityBatchFormValues>;
	leaseId: string; // always pre-set from context
	onSubmit: (values: UtilityBatchFormValues) => void;
	isSubmitting?: boolean;
	submitLabel?: string;
}

const ELECTRICITY_DEFAULTS: MeterReading = {
	previousReading: 0,
	currentReading: 0,
	ratePerUnit: paiseToFormValue(RATEPERUNIT),
	fixedCharge: paiseToFormValue(FIXEDCHARGE),
	isPaid: false,
};

const WATER_DEFAULTS: FixedCharge = {
	fixedCharge: 100,
	description: undefined,
	isPaid: false,
};

const MAINTENANCE_DEFAULTS: FixedCharge = {
	fixedCharge: 0,
	description: undefined,
	isPaid: false,
};

function calcElectricityPreview(elec: MeterReading | undefined): number {
	if (!elec) return 0;
	const units = Math.max(0, elec.currentReading - elec.previousReading);
	return units * elec.ratePerUnit + elec.fixedCharge;
}
export function UtilityForm({
	defaultValues,
	leaseId,
	onSubmit,
	isSubmitting = false,
	submitLabel = "Save Reading",
}: UtilityFormProps) {
	const {
		register,
		handleSubmit,
		setValue,
		watch,
		formState: { errors },
	} = useForm<UtilityBatchFormValues>({
		resolver: zodResolver(UtilityBatchFormSchema),
		defaultValues: {
			leaseId,
			batchId: generatedId(),
			previousReadingDate: new Date().toISOString().split("T")[0] ?? "",
			currentReadingDate: new Date().toISOString().split("T")[0] ?? "",
			electricity: defaultValues?.electricity ?? ELECTRICITY_DEFAULTS,
			water: defaultValues?.water ?? WATER_DEFAULTS,
			maintenance: defaultValues?.maintenance ?? MAINTENANCE_DEFAULTS,
		},
	});

	const electricityValue = watch("electricity");
	const waterValue = watch("water");
	const maintenanceValue = watch("maintenance");

	const showElectricity = electricityValue !== undefined;
	const showWater = waterValue !== undefined;
	const showMaintenance = maintenanceValue !== undefined;

	function toggleElectricity(on: boolean) {
		setValue("electricity", on ? ELECTRICITY_DEFAULTS : undefined);
	}
	function toggleWater(on: boolean) {
		setValue("water", on ? WATER_DEFAULTS : undefined);
	}
	function toggleMaintenance(on: boolean) {
		setValue("maintenance", on ? MAINTENANCE_DEFAULTS : undefined);
	}

	const electricityPreview = calcElectricityPreview(electricityValue);
	const totalPreview =
		electricityPreview +
		(waterValue?.fixedCharge ?? 0) +
		(maintenanceValue?.fixedCharge ?? 0);

	return (
		<form
			onSubmit={handleSubmit(onSubmit, (errors) => console.log("form", errors))}
			className="space-y-6"
		>
			<FieldSet>
				<FieldLegend>Billing Period</FieldLegend>
				<FieldGroup className="grid grid-cols-2 gap-4">
					{/* Previous Reading Date — native input, register() attaches by ref */}
					<Field data-invalid={!!errors.previousReadingDate}>
						<FieldLabel htmlFor="previousReadingDate">From</FieldLabel>
						<FieldContent>
							<Input
								id="previousReadingDate"
								type="date"
								disabled={isSubmitting}
								{...register("previousReadingDate")}
								aria-invalid={!!errors.previousReadingDate}
							/>
						</FieldContent>
						<FieldError errors={[errors.previousReadingDate]} />
					</Field>

					{/* Reading Date — native input, register() attaches by ref */}
					<Field data-invalid={!!errors.currentReadingDate}>
						<FieldLabel htmlFor="currentReadingDate">To</FieldLabel>
						<FieldContent>
							<Input
								id="currentReadingDate"
								type="date"
								disabled={isSubmitting}
								{...register("currentReadingDate")}
								aria-invalid={!!errors.currentReadingDate}
							/>
						</FieldContent>
						<FieldError errors={[errors.currentReadingDate]} />
					</Field>
				</FieldGroup>
			</FieldSet>

			{/* Electricity*/}
			<FieldSet className="rounded-lg border p-4">
				<div className="mb-3 flex items-center justify-between">
					<FieldLegend className="font-medium text-sm">
						⚡ Electricity
					</FieldLegend>
					<Switch
						checked={showElectricity}
						onCheckedChange={toggleElectricity}
					/>
				</div>
				{showElectricity && (
					<FieldGroup className="space-y-3">
						<div className="grid grid-cols-2 gap-3">
							<Field>
								<FieldLabel>Previous Reading</FieldLabel>
								<FieldContent>
									<Input
										type="number"
										step="0.01"
										disabled={isSubmitting}
										{...register("electricity.previousReading", {
											valueAsNumber: true,
										})}
									/>
								</FieldContent>
								<FieldError errors={[errors.electricity?.previousReading]} />
							</Field>
							<Field>
								<FieldLabel>Current Reading</FieldLabel>
								<FieldContent>
									<Input
										type="number"
										step="0.01"
										{...register("electricity.currentReading", {
											valueAsNumber: true,
										})}
									/>
								</FieldContent>
								<FieldError errors={[errors.electricity?.currentReading]} />
							</Field>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<Field>
								<FieldLabel>Rate / Unit (₹)</FieldLabel>
								<FieldContent>
									<Input
										type="number"
										step="0.01"
										{...register("electricity.ratePerUnit", {
											valueAsNumber: true,
										})}
									/>
								</FieldContent>
								<FieldError errors={[errors.electricity?.ratePerUnit]} />
							</Field>
							<Field>
								<FieldLabel>Fixed Charge (₹)</FieldLabel>
								<FieldContent>
									<Input
										type="number"
										step="0.01"
										{...register("electricity.fixedCharge", {
											valueAsNumber: true,
										})}
									/>
								</FieldContent>
								<FieldError errors={[errors.electricity?.fixedCharge]} />
							</Field>
						</div>
						{electricityPreview > 0 && (
							<p className="text-muted-foreground text-xs">
								Preview:{" "}
								<span className="font-medium text-foreground">
									₹{electricityPreview.toFixed(2)}
								</span>{" "}
								(
								{Math.max(
									0,
									(electricityValue?.currentReading ?? 0) -
										(electricityValue?.previousReading ?? 0),
								).toFixed(2)}{" "}
								units)
							</p>
						)}
					</FieldGroup>
				)}
			</FieldSet>
			{/* ── Water section (fixed mode) ────────────────────────── */}
			<FieldSet className="rounded-lg border p-4">
				<div className="mb-3 flex items-center justify-between">
					<FieldLegend className="font-medium text-sm">
						💧 Water (Fixed)
					</FieldLegend>
					<Switch checked={showWater} onCheckedChange={toggleWater} />
				</div>
				{showWater && (
					<FieldGroup className="space-y-3">
						<Field>
							<FieldLabel>Fixed Amount (₹)</FieldLabel>
							<FieldContent>
								<Input
									type="number"
									step="0.01"
									{...register("water.fixedCharge", { valueAsNumber: true })}
								/>
							</FieldContent>
							<FieldError errors={[errors.water?.fixedCharge]} />
						</Field>
						<Field>
							<FieldLabel>Description (optional)</FieldLabel>
							<FieldContent>
								<Input
									placeholder="e.g. Monthly water charges"
									{...register("water", {
										setValueAs: (v) => (v === "" ? undefined : v),
									})}
								/>
							</FieldContent>
						</Field>
					</FieldGroup>
				)}
			</FieldSet>
			{/* ── Maintenance section ───────────────────────────────── */}
			<FieldSet className="rounded-lg border p-4">
				<div className="mb-3 flex items-center justify-between">
					<FieldLegend className="font-medium text-sm">
						🔧 Maintenance
					</FieldLegend>
					<Switch
						checked={showMaintenance}
						onCheckedChange={toggleMaintenance}
					/>
				</div>
				{showMaintenance && (
					<FieldGroup className="space-y-3">
						<Field>
							<FieldLabel>Amount (₹)</FieldLabel>
							<FieldContent>
								<Input
									type="number"
									step="0.01"
									{...register("maintenance.fixedCharge", {
										valueAsNumber: true,
									})}
								/>
							</FieldContent>
							<FieldError errors={[errors.maintenance?.fixedCharge]} />
						</Field>
						<Field>
							<FieldLabel>Description (optional)</FieldLabel>
							<FieldContent>
								<Input
									placeholder="e.g. Plumbing repair, painting..."
									{...register("maintenance.description", {
										setValueAs: (v) => (v === "" ? undefined : v),
									})}
								/>
							</FieldContent>
						</Field>
					</FieldGroup>
				)}
			</FieldSet>

			{/* Grand total preview */}
			{totalPreview > 0 && (
				<div className="rounded-md bg-muted px-4 py-2 text-sm">
					<span className="text-muted-foreground">Total Bill: </span>
					<span className="font-semibold">₹{totalPreview.toFixed(2)}</span>
				</div>
			)}

			<Button type="submit" disabled={isSubmitting} className="w-full">
				{isSubmitting ? "Saving..." : submitLabel}
			</Button>
		</form>
	);
}
