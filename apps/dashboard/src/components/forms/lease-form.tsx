"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type {
	UnitFurnishing,
	UnitType,
} from "@rently/db/constants/rent-constants";
import { Badge } from "@rently/ui/components/badge";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldSet,
} from "@rently/ui/components/field";
import { Input } from "@rently/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@rently/ui/components/select";
import {
	IconAlertCircle,
	IconBuildingStore,
	IconCheck,
	IconHome,
	IconRuler,
	IconSofa,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { type Resolver, useForm } from "react-hook-form";
import z from "zod";

// ── Types ────────

// WHY: UnitOption is a projection of UnitDetail — only the fields the form
// needs. Keeps the form decoupled from the full DB row type.
export type UnitOption = {
	id: string;
	propertyId: string;
	unitNumber: string;
	propertyName: string;
	baseRent: number;
	type?: string | null;
	area?: number | null;
	furnishing?: string | null;
};

type PropertyOption = {
	id: string;
	name: string;
};

type TenantOption = {
	id: string;
	name: string;
	email: string;
};

// ── Form schema ──────────────
// WHY: String dates — <input type="date"> produces "YYYY-MM-DD" strings.
// The conversion to Date happens at the mutation call site (the handler), not here.
export const LeaseFormSchema = z
	.object({
		unitId: z.string().min(1, "Select a unit"),
		tenantId: z.string().min(1, "Select a tenant"),
		startDate: z.string().min(1, "Start date is required"),
		endDate: z.string().optional(),
		rent: z.number().min(1, "Rent must be > 0"),
		deposit: z.number().optional(),
	})
	.refine(
		({ startDate, endDate }) =>
			!endDate || !startDate || new Date(endDate) > new Date(startDate),
		{
			message: "End date must be after start date",
			path: ["endDate"],
		},
	);

export type LeaseFormValues = z.infer<typeof LeaseFormSchema>;

// ── Props ─────────

interface LeaseFormProps {
	propertyId?: string;
	formId?: string;
	properties?: PropertyOption[];
	units: UnitOption[];
	tenants: TenantOption[];
	defaultValues?: Partial<LeaseFormValues>;
	onSubmit: (values: LeaseFormValues) => void;
	isSubmitting?: boolean;
	// submitLabel?: string;
}

// ── Display helpers ────────────────────────────────────────────────────────────

const FURNISHING_LABELS: Partial<Record<UnitFurnishing, string>> = {
	unfurnished: "Unfurnished",
	semi_furnished: "Semi-Furnished",
	fully_furnished: "Fully Furnished",
};

const UNIT_TYPE_LABELS: Partial<Record<UnitType, string>> = {
	studio: "Studio",
	shop: "Shop",
	"1BHK": "1 BHK",
	"2BHK": "2 BHK",
	"3BHK": "3 BHK",
	"4BHK": "4 BHK",
};

// ── Component ──────────────────────────────────────────────────────────────────

export function LeaseForm({
	properties = [],
	propertyId: initialPropertyId,
	formId,
	units,
	tenants,
	defaultValues,
	onSubmit,
	isSubmitting,
	// submitLabel = "Save Lease",
}: LeaseFormProps) {
	const {
		register,
		handleSubmit,
		setValue,
		watch,
		formState: { errors },
	} = useForm<LeaseFormValues>({
		resolver: zodResolver(LeaseFormSchema) as Resolver<LeaseFormValues>,
		defaultValues: {
			unitId: "",
			tenantId: "",
			...defaultValues,
		},
	});

	// WHY: separate local state for selected property, not a form field.
	// propertyId is never submitted — it's only used to scope the unit list.
	const [selectedPropertyId, setSelectedPropertyId] = useState<string>(
		initialPropertyId ?? "",
	);

	const watchedUnitId = watch("unitId");
	const watchedTenantId = watch("tenantId");

	// The currently selected unit object — drives the info display + rent pre-fill
	const selectedUnit = units.find((u) => u.id === watchedUnitId) ?? null;

	// Units visible in the card grid
	const propertyUnits = selectedPropertyId
		? units.filter((u) => u.propertyId === selectedPropertyId)
		: [];

	// Read-only property label when propertyId is pre-set from context
	const presetPropertyName = initialPropertyId
		? (properties.find((p) => p.id === initialPropertyId)?.name ?? null)
		: null;

	// WHY: edit mode = defaultValues.unitId is already populated.
	// In edit mode we skip the cascade and show read-only unit + tenant info.
	const isEditMode = !!defaultValues?.unitId;

	// Auto-fill rent from the selected unit's baseRent
	// WHY: useEffect not onChange — the unit changes both via card click AND
	// via defaultValues on mount (edit mode). useEffect handles both cases.
	useEffect(() => {
		if (selectedUnit && !isEditMode) {
			setValue("rent", selectedUnit.baseRent, { shouldValidate: true });
		}
	}, [selectedUnit, isEditMode, setValue]);

	// When the owner changes property, reset unit + rent — previous selection is now stale
	function handlePropertyChange(newPropertyId: string | null) {
		setSelectedPropertyId(newPropertyId ?? "");
		setValue("unitId", "", { shouldValidate: false });
		setValue("rent", 0, { shouldValidate: false });
	}

	function handleUnitSelect(unitId: string) {
		setValue("unitId", unitId, { shouldValidate: true });
	}

	// ── Guard: no tenants ──────────────────────────────────────────────────────
	if (tenants.length === 0) {
		return (
			<div className="flex flex-col items-center gap-4 rounded-lg border border-dashed p-8 text-center">
				<div className="flex size-10 items-center justify-center rounded-full bg-muted">
					<IconAlertCircle className="size-5 text-muted-foreground" />
				</div>
				<div>
					<p className="font-medium text-sm">No tenants yet</p>
					<p className="mt-1 text-muted-foreground text-sm">
						Add a tenant before creating a lease.
					</p>
				</div>
			</div>
		);
	}

	return (
		<form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-5">
			<FieldSet>
				<FieldGroup className="flex flex-col gap-4">
					{/* ── EDIT MODE: read-only unit + tenant badges ───────────────── */}
					{isEditMode ? (
						<>
							{/* Unit info — read-only in edit mode */}
							{selectedUnit && <ReadOnlyUnitBadge unit={selectedUnit} />}
							{/* Tenant info — read-only in edit mode */}
							{watchedTenantId && (
								<ReadOnlyTenantBadge
									tenant={tenants.find((t) => t.id === watchedTenantId)}
								/>
							)}
						</>
					) : (
						<>
							{/* ── CREATE MODE: property → unit cascade ────────────────── */}

							{/* Step 1 — Property */}
							{initialPropertyId ? (
								// Pre-set from context (e.g. from property detail page)
								presetPropertyName && (
									<div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
										<span className="text-muted-foreground">Property:</span>
										<span className="font-medium">{presetPropertyName}</span>
									</div>
								)
							) : (
								<Field>
									<FieldLabel>Property</FieldLabel>
									<Select
										value={selectedPropertyId}
										onValueChange={handlePropertyChange}
										disabled={isSubmitting}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select a property first" />
										</SelectTrigger>
										<SelectContent>
											{properties.length === 0 ? (
												<SelectItem value="__empty__" disabled>
													No properties yet
												</SelectItem>
											) : (
												properties.map((p) => (
													<SelectItem key={p.id} value={p.id}>
														{p.name}
													</SelectItem>
												))
											)}
										</SelectContent>
									</Select>
								</Field>
							)}

							{/* Step 2 — Unit cards (only after a property is selected) */}
							{selectedPropertyId && (
								<Field data-invalid={!!errors.unitId}>
									<FieldLabel>Unit</FieldLabel>
									{propertyUnits.length === 0 ? (
										<p className="rounded-md border border-dashed px-3 py-6 text-center text-muted-foreground text-sm">
											No available units for this property
										</p>
									) : (
										// WHY: max-h + overflow-y — dialogs have fixed height.
										// If a property has many units, the list stays scrollable.
										<div className="max-h-52 space-y-2 overflow-y-auto pr-1">
											{propertyUnits.map((unit) => (
												<UnitCard
													key={unit.id}
													unit={unit}
													selected={watchedUnitId === unit.id}
													onSelect={handleUnitSelect}
													disabled={isSubmitting}
												/>
											))}
										</div>
									)}
									<FieldError errors={[errors.unitId]} />
								</Field>
							)}
						</>
					)}

					{/* ── Fields — shown once a unit is resolved (create OR edit) ── */}
					{(watchedUnitId || isEditMode) && (
						<>
							{/* Tenant — only shown in create mode (edit = read-only above) */}
							{!isEditMode && (
								<Field data-invalid={!!errors.tenantId}>
									<FieldLabel>Tenant</FieldLabel>
									<Select
										value={watchedTenantId}
										onValueChange={(val) =>
											setValue("tenantId", val ?? "", { shouldValidate: true })
										}
										disabled={isSubmitting}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select a tenant" />
										</SelectTrigger>
										<SelectContent>
											{tenants.map((t) => (
												<SelectItem key={t.id} value={t.id}>
													<span>{t.name}</span>
													<span className="ml-2 text-muted-foreground text-xs">
														{t.email}
													</span>
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FieldError errors={[errors.tenantId]} />
								</Field>
							)}

							{/* Dates */}
							<div className="grid grid-cols-2 gap-3">
								<Field data-invalid={!!errors.startDate}>
									<FieldLabel>Start Date</FieldLabel>
									<Input
										type="date"
										disabled={isSubmitting}
										{...register("startDate")}
									/>
									<FieldError errors={[errors.startDate]} />
								</Field>
								<Field data-invalid={!!errors.endDate}>
									<FieldLabel>
										End Date{" "}
										<span className="text-muted-foreground text-xs">
											(optional)
										</span>
									</FieldLabel>
									<Input
										type="date"
										disabled={isSubmitting}
										{...register("endDate")}
									/>
									<FieldError errors={[errors.endDate]} />
								</Field>
							</div>

							{/* Rent + Deposit */}
							<div className="grid grid-cols-2 gap-3">
								<Field data-invalid={!!errors.rent}>
									<FieldLabel>Monthly Rent (₹)</FieldLabel>
									<Input
										type="number"
										min={0}
										step={100}
										disabled={isSubmitting}
										{...register("rent", { valueAsNumber: true })}
									/>
									<FieldError errors={[errors.rent]} />
								</Field>
								<Field data-invalid={!!errors.deposit}>
									<FieldLabel>
										Deposit (₹){" "}
										<span className="text-muted-foreground text-xs">
											(optional)
										</span>
									</FieldLabel>
									<Input
										type="number"
										min={0}
										step={100}
										disabled={isSubmitting}
										{...register("deposit", { valueAsNumber: true })}
									/>
									<FieldError errors={[errors.deposit]} />
								</Field>
							</div>
						</>
					)}
				</FieldGroup>
			</FieldSet>
		</form>
	);
}

// ── Sub-components ───────

function UnitCard({
	unit,
	selected,
	onSelect,
	disabled,
}: {
	unit: UnitOption;
	selected: boolean;
	onSelect: (id: string) => void;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={() => onSelect(unit.id)}
			disabled={disabled}
			className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all ${
				selected
					? "border-primary bg-primary/5 ring-1 ring-primary"
					: "border-border hover:border-primary/40 hover:bg-muted/40"
			} ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
		>
			{/* Icon */}
			<div
				className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
					selected ? "bg-primary/10" : "bg-muted"
				}`}
			>
				{unit.type === "shop" ? (
					<IconBuildingStore
						className={`size-4 ${selected ? "text-primary" : "text-muted-foreground"}`}
					/>
				) : (
					<IconHome
						className={`size-4 ${selected ? "text-primary" : "text-muted-foreground"}`}
					/>
				)}
			</div>

			{/* Unit info */}
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<span className="font-medium text-sm">{unit.unitNumber}</span>
					{unit.type && (
						<span className="rounded-full bg-muted px-2 py-0.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
							{UNIT_TYPE_LABELS[unit.type as UnitType] ?? unit.type}
						</span>
					)}
				</div>
				<div className="mt-0.5 flex items-center gap-3 text-muted-foreground text-xs">
					{unit.area != null && (
						<span className="flex items-center gap-1">
							<IconRuler className="size-3" />
							{unit.area} sq ft
						</span>
					)}
					{unit.furnishing && (
						<span className="flex items-center gap-1">
							<IconSofa className="size-3" />
							{FURNISHING_LABELS[unit.furnishing as UnitFurnishing] ??
								unit.furnishing}
						</span>
					)}
					{/* WHY: rent pushed to the right — most prominent decision factor */}
					<span className="ml-auto font-semibold text-foreground text-xs">
						₹{unit.baseRent.toLocaleString()}/mo
					</span>
				</div>
			</div>

			{selected && <IconCheck className="size-4 shrink-0 text-primary" />}
		</button>
	);
}

// WHY: read-only badges for edit mode — unit and tenant cannot change on an
// existing lease, so we show info rather than interactive controls.
function ReadOnlyUnitBadge({ unit }: { unit: UnitOption }) {
	return (
		<div className="flex items-center gap-3 rounded-md border bg-muted/50 px-3 py-2.5">
			<div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
				{unit.type === "shop" ? (
					<IconBuildingStore className="size-4 text-muted-foreground" />
				) : (
					<IconHome className="size-4 text-muted-foreground" />
				)}
			</div>
			<div className="min-w-0 flex-1">
				<p className="font-medium text-sm">{unit.unitNumber}</p>
				<p className="text-muted-foreground text-xs">{unit.propertyName}</p>
			</div>
			<Badge variant="secondary" className="shrink-0 text-xs">
				Unit
			</Badge>
		</div>
	);
}

function ReadOnlyTenantBadge({ tenant }: { tenant: TenantOption | undefined }) {
	if (!tenant) return null;
	return (
		<div className="flex items-center gap-3 rounded-md border bg-muted/50 px-3 py-2.5">
			<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground text-sm">
				{tenant.name.charAt(0).toUpperCase()}
			</div>
			<div className="min-w-0 flex-1">
				<p className="font-medium text-sm">{tenant.name}</p>
				<p className="truncate text-muted-foreground text-xs">{tenant.email}</p>
			</div>
			<Badge variant="secondary" className="shrink-0 text-xs">
				Tenant
			</Badge>
		</div>
	);
}
