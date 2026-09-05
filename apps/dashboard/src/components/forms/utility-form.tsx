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
	FieldSet,
} from "@rently/ui/components/field";
import { Input } from "@rently/ui/components/input";
import { Switch } from "@rently/ui/components/switch";
import { formatFormRupees, paiseToFormValue } from "@rently/ui/lib/currency";
import { cn } from "@rently/ui/lib/utils";
import {
	type FixedCharge,
	type MeterReading,
	UtilityBatchFormSchema,
	type UtilityBatchFormValues,
} from "@rently/validators";
import {
	IconBolt,
	IconDroplet,
	IconReceipt,
	IconTool,
} from "@tabler/icons-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

// ─── Types ──────────────────────

interface UtilityFormProps {
	defaultValues?: Partial<UtilityBatchFormValues>;
	leaseId: string;
	initialType?: "electricity" | "water" | "maintenance";
	onSubmit: (values: UtilityBatchFormValues) => void;
	isSubmitting?: boolean;
	submitLabel?: string;
	formId?: string;
}

type UtilityTab = "electricity" | "water" | "maintenance";

// ─── Constants ─────────────────────────────

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

const TAB_CONFIG = [
	{
		id: "electricity" as const,
		label: "Electricity",
		Icon: IconBolt,
		iconColor: "text-amber-500",
		activeBg: "bg-amber-50 dark:bg-amber-950/30",
		activeBorder: "border-amber-500",
	},
	{
		id: "water" as const,
		label: "Water",
		Icon: IconDroplet,
		iconColor: "text-blue-500",
		activeBg: "bg-blue-50 dark:bg-blue-950/30",
		activeBorder: "border-blue-500",
	},
	{
		id: "maintenance" as const,
		label: "Maintenance",
		Icon: IconTool,
		iconColor: "text-slate-500",
		activeBg: "bg-slate-50 dark:bg-slate-900/40",
		activeBorder: "border-slate-500",
	},
] as const;

// ─── Helpers ────────────────────

function calcElectricityAmount(elec: MeterReading | undefined): number {
	if (!elec) return 0;
	const units = Math.max(0, elec.currentReading - elec.previousReading);
	return units * elec.ratePerUnit + elec.fixedCharge;
}

// ─── Component ─────────────────────────

export function UtilityForm({
	defaultValues,
	leaseId,
	initialType,
	onSubmit,
	isSubmitting = false,
	submitLabel = "Save Reading",
	formId,
}: UtilityFormProps) {
	// Start on the initialType tab, or electricity by default
	const [activeTab, setActiveTab] = useState<UtilityTab>(
		initialType ?? "electricity",
	);

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
			electricity:
				defaultValues?.electricity ??
				(!initialType || initialType === "electricity"
					? ELECTRICITY_DEFAULTS
					: undefined),
			water:
				defaultValues?.water ??
				(!initialType || initialType === "water" ? WATER_DEFAULTS : undefined),
			maintenance:
				defaultValues?.maintenance ??
				(!initialType || initialType === "maintenance"
					? MAINTENANCE_DEFAULTS
					: undefined),
		},
	});

	const electricityValue = watch("electricity");
	const waterValue = watch("water");
	const maintenanceValue = watch("maintenance");

	const isEnabled: Record<UtilityTab, boolean> = {
		electricity: electricityValue !== undefined,
		water: waterValue !== undefined,
		maintenance: maintenanceValue !== undefined,
	};

	function toggleTab(tab: UtilityTab, on: boolean) {
		if (tab === "electricity")
			setValue("electricity", on ? ELECTRICITY_DEFAULTS : undefined);
		if (tab === "water") setValue("water", on ? WATER_DEFAULTS : undefined);
		if (tab === "maintenance")
			setValue("maintenance", on ? MAINTENANCE_DEFAULTS : undefined);
	}

	// ─── Preview amounts ────────────────────

	const electricityAmount = calcElectricityAmount(electricityValue);
	const waterAmount = waterValue?.fixedCharge ?? 0;
	const maintenanceAmount = maintenanceValue?.fixedCharge ?? 0;
	const totalAmount = electricityAmount + waterAmount + maintenanceAmount;

	const enabledCount = Object.values(isEnabled).filter(Boolean).length;

	return (
		<form
			id={formId}
			onSubmit={handleSubmit(onSubmit)}
			className="flex flex-col gap-6"
		>
			{/* ── Billing Period ──────────────────────── */}
			<section className="rounded-lg border bg-card p-4">
				<p className="mb-3 font-medium text-sm">Billing Period</p>
				<FieldSet>
					<FieldGroup className="grid grid-cols-2 gap-3">
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
			</section>

			{/* ── Tab Bar + Panels ───────────── */}
			<section className="overflow-hidden rounded-lg border bg-card">
				{/* Tab navigation */}
				<div className="flex border-b">
					{TAB_CONFIG.map(({ id, label, Icon, iconColor, activeBorder }) => {
						const active = activeTab === id;
						const enabled = isEnabled[id];

						return (
							<button
								key={id}
								type="button"
								onClick={() => setActiveTab(id)}
								className={cn(
									"relative flex flex-1 cursor-pointer items-center justify-center gap-2 border-b-2 px-4 py-3 text-sm transition-colors focus-visible:outline-none",
									active
										? cn("border-current font-medium", iconColor, activeBorder)
										: "border-transparent text-muted-foreground hover:text-foreground",
								)}
							>
								<Icon
									className={cn(
										"size-4 shrink-0 transition-colors",
										active ? iconColor : "text-current",
									)}
								/>
								<span>{label}</span>

								{/* Enabled dot indicator */}
								{enabled && (
									<span
										className={cn(
											"size-1.5 rounded-full",
											active ? iconColor : "bg-muted-foreground",
											// Use bg instead of text for the dot
											active ? "bg-current" : "bg-muted-foreground",
										)}
									/>
								)}
							</button>
						);
					})}
				</div>

				{/* Tab panels */}
				{TAB_CONFIG.map(({ id, label, Icon, iconColor, activeBg }) => {
					if (activeTab !== id) return null;
					const enabled = isEnabled[id];

					return (
						<div key={id} className="p-5">
							{/* Panel header — label + toggle */}
							<div className="mb-4 flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Icon className={cn("size-5", iconColor)} />
									<span className="font-medium text-sm">{label}</span>
								</div>

								<div className="flex items-center gap-2">
									<span className="text-muted-foreground text-xs">
										{enabled ? "Included" : "Not included"}
									</span>
									<Switch
										checked={enabled}
										onCheckedChange={(on) => toggleTab(id, on)}
										disabled={isSubmitting}
									/>
								</div>
							</div>

							{/* Panel body */}
							{enabled ? (
								<div className={cn("rounded-md p-4 transition-all", activeBg)}>
									{id === "electricity" && (
										<ElectricityPanel
											register={register}
											errors={errors}
											isSubmitting={isSubmitting}
											electricityValue={electricityValue}
										/>
									)}
									{id === "water" && (
										<FixedChargePanel
											register={register}
											errors={errors}
											prefix="water"
											isSubmitting={isSubmitting}
											amountLabel="Fixed Amount (₹)"
											placeholder="e.g. Monthly water charges"
										/>
									)}
									{id === "maintenance" && (
										<FixedChargePanel
											register={register}
											errors={errors}
											prefix="maintenance"
											isSubmitting={isSubmitting}
											amountLabel="Amount (₹)"
											placeholder="e.g. Plumbing repair, painting..."
										/>
									)}
								</div>
							) : (
								// Empty state when tab is not included
								<div className="flex flex-col items-center gap-2 py-8 text-center">
									<Icon className={cn("size-8 opacity-20", iconColor)} />
									<p className="text-muted-foreground text-sm">
										Toggle the switch above to include{" "}
										<span className="lowercase">{label}</span> in this reading.
									</p>
								</div>
							)}
						</div>
					);
				})}
			</section>

			{/* ── Summary & Submit ───────────────── */}
			<section className="rounded-lg border bg-card p-4">
				<p className="mb-3 font-medium text-muted-foreground text-sm">
					Bill Summary
				</p>

				{enabledCount === 0 ? (
					<p className="text-muted-foreground text-xs">
						No utility types selected yet. Enable at least one above.
					</p>
				) : (
					<div className="mb-4 space-y-1.5">
						{isEnabled.electricity && electricityAmount > 0 && (
							<SummaryRow
								icon={<IconBolt className="size-3.5 text-amber-500" />}
								label="Electricity"
								amount={formatFormRupees(electricityAmount)}
							/>
						)}
						{isEnabled.water && waterAmount > 0 && (
							<SummaryRow
								icon={<IconDroplet className="size-3.5 text-blue-500" />}
								label="Water"
								amount={formatFormRupees(waterAmount)}
							/>
						)}
						{isEnabled.maintenance && maintenanceAmount > 0 && (
							<SummaryRow
								icon={<IconTool className="size-3.5 text-slate-500" />}
								label="Maintenance"
								amount={formatFormRupees(maintenanceAmount)}
							/>
						)}

						{totalAmount > 0 && (
							<>
								<div className="my-2 border-t" />
								<div className="flex items-center justify-between">
									<span className="flex items-center gap-1.5 font-medium text-sm">
										<IconReceipt className="size-4 text-primary" />
										Total Bill
									</span>
									<span className="font-semibold text-primary text-sm">
										{formatFormRupees(totalAmount)}
									</span>
								</div>
							</>
						)}
					</div>
				)}

				{!formId && (
					<Button
						type="submit"
						disabled={isSubmitting || enabledCount === 0}
						className="w-full"
					>
						{isSubmitting ? "Saving..." : submitLabel}
					</Button>
				)}
			</section>
		</form>
	);
}

// ─── Sub-components ────────────────────────

function ElectricityPanel({
	register,
	errors,
	isSubmitting,
	electricityValue,
}: {
	register: ReturnType<typeof useForm<UtilityBatchFormValues>>["register"];
	errors: ReturnType<
		typeof useForm<UtilityBatchFormValues>
	>["formState"]["errors"];
	isSubmitting: boolean;
	electricityValue: MeterReading | undefined;
}) {
	const units = Math.max(
		0,
		(electricityValue?.currentReading ?? 0) -
			(electricityValue?.previousReading ?? 0),
	);

	return (
		<FieldSet>
			<FieldGroup className="space-y-3">
				<div className="grid grid-cols-2 gap-3">
					<Field>
						<FieldLabel>Previous Reading (kWh)</FieldLabel>
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
						<FieldLabel>Current Reading (kWh)</FieldLabel>
						<FieldContent>
							<Input
								type="number"
								step="0.01"
								disabled={isSubmitting}
								{...register("electricity.currentReading", {
									valueAsNumber: true,
								})}
							/>
						</FieldContent>
						<FieldError errors={[errors.electricity?.currentReading]} />
					</Field>
				</div>
				<FieldError errors={[errors.electricity]} />

				<div className="grid grid-cols-2 gap-3">
					<Field>
						<FieldLabel>Rate per Unit (₹/kWh)</FieldLabel>
						<FieldContent>
							<Input
								type="number"
								step="0.01"
								disabled={isSubmitting}
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
								disabled={isSubmitting}
								{...register("electricity.fixedCharge", {
									valueAsNumber: true,
								})}
							/>
						</FieldContent>
						<FieldError errors={[errors.electricity?.fixedCharge]} />
					</Field>
				</div>

				{units > 0 && (
					<p className="rounded bg-amber-100 px-3 py-1.5 text-amber-800 text-xs dark:bg-amber-900/30 dark:text-amber-300">
						{units.toFixed(2)} units consumed · ₹
						{((electricityValue?.ratePerUnit ?? 0) * units).toFixed(2)} usage +
						₹{(electricityValue?.fixedCharge ?? 0).toFixed(2)} fixed
					</p>
				)}
			</FieldGroup>
		</FieldSet>
	);
}

function FixedChargePanel({
	register,
	errors,
	prefix,
	isSubmitting,
	amountLabel,
	placeholder,
}: {
	register: ReturnType<typeof useForm<UtilityBatchFormValues>>["register"];
	errors: ReturnType<
		typeof useForm<UtilityBatchFormValues>
	>["formState"]["errors"];
	prefix: "water" | "maintenance";
	isSubmitting: boolean;
	amountLabel: string;
	placeholder: string;
}) {
	const fieldErrors = errors[prefix];

	return (
		<FieldSet>
			<FieldGroup className="space-y-3">
				<Field>
					<FieldLabel>{amountLabel}</FieldLabel>
					<FieldContent>
						<Input
							type="number"
							step="0.01"
							disabled={isSubmitting}
							{...register(`${prefix}.fixedCharge`, { valueAsNumber: true })}
						/>
					</FieldContent>
					<FieldError
						errors={[
							"fixedCharge" in (fieldErrors ?? {})
								? (fieldErrors as { fixedCharge?: { message?: string } })
										?.fixedCharge
								: undefined,
						]}
					/>
				</Field>

				<Field>
					<FieldLabel>Description (optional)</FieldLabel>
					<FieldContent>
						<Input
							placeholder={placeholder}
							disabled={isSubmitting}
							{...register(`${prefix}.description`, {
								setValueAs: (v) => (v === "" ? undefined : v),
							})}
						/>
					</FieldContent>
				</Field>
			</FieldGroup>
		</FieldSet>
	);
}

function SummaryRow({
	icon,
	label,
	amount,
}: {
	icon: React.ReactNode;
	label: string;
	amount: string;
}) {
	return (
		<div className="flex items-center justify-between text-sm">
			<span className="flex items-center gap-1.5 text-muted-foreground">
				{icon}
				{label}
			</span>
			<span className="tabular-nums">{amount}</span>
		</div>
	);
}
