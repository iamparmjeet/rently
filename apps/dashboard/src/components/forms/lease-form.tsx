// apps/web/src/components/forms/lease-form.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@rently/ui/components/button";
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
import { LeaseInsertSchema } from "@rently/validators/lease";
import { IconAlertCircle, IconUserPlus } from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { type Resolver, useForm } from "react-hook-form";
import z from "zod";

// Form-specific schema — dates as strings (HTML date input returns strings)
const LeaseFormSchema = LeaseInsertSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
	status: true,
})
	.extend({
		startDate: z.string().min(1, { error: "Start date is required" }),
		endDate: z.string().optional(),
		rent: z.coerce.number().min(1, { error: "Rent must be greater than 0" }),
		deposit: z.coerce
			.number()
			.min(0, { error: "Deposit cannot be negative" })
			.optional(),
	})
	.refine(
		(data) => {
			if (data.endDate && data.startDate) {
				return new Date(data.endDate) > new Date(data.startDate);
			}
			return true;
		},
		{ message: "End date must be after start date", path: ["endDate"] },
	);

export type LeaseFormValues = z.infer<typeof LeaseFormSchema>;

export interface PropertyOption {
	id: string;
	name: string;
}

interface UnitOption {
	id: string;
	unitNumber: string;
	propertyName: string;
	propertyId: string;
	baseRent: number;
}

interface TenantOption {
	id: string;
	name: string;
	email: string;
}

interface LeaseFormProps {
	propertyId?: string;
	properties?: PropertyOption[];
	units: UnitOption[];
	tenants: TenantOption[];
	defaultValues?: Partial<LeaseFormValues>;
	onSubmit: (values: LeaseFormValues) => void;
	isSubmitting?: boolean;
	submitLabel?: string;
	formId?: string;
}

export function LeaseForm({
	properties = [],
	propertyId: initialPropertyId,
	formId,
	units,
	tenants,
	defaultValues,
	onSubmit,
	isSubmitting,
	submitLabel = "Save Lease",
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
			tenantId: "",
			unitId: "",
			...defaultValues,
		},
	});

	const [selectedPropertyId, setSelectedPropertyId] = useState<string>(
		initialPropertyId ?? "",
	);

	const watchedUnitId = watch("unitId");
	const watchedTenantId = watch("tenantId");

	const filteredUnits = selectedPropertyId
		? units.filter((u) => u.propertyId === selectedPropertyId)
		: units; // fallback: show all (used when propertyId is pre-set and units are already scoped)

	// Resolve property name for the read-only label when propertyId is pre-set
	const presetPropertyName = initialPropertyId
		? (properties.find((p) => p.id === initialPropertyId)?.name ?? null)
		: null;

	// Auto-fill rent from the unit's baseRent when unit selection changes
	useEffect(() => {
		const unit = units.find((u) => u.id === watchedUnitId);
		if (unit) {
			setValue("rent", unit.baseRent, { shouldValidate: true });
		}
	}, [watchedUnitId, units, setValue]);

	// When the owner changes property, the previously selected unit is now invalid
	function handlePropertyChange(newPropertyId: string | null) {
		setSelectedPropertyId(newPropertyId ?? "");
		setValue("unitId", "", { shouldValidate: false });
		setValue("rent", 0, { shouldValidate: false });
	}

	console.log({
		selectedPropertyId,
		unit0PropertyId: units[0]?.propertyId, // ← actual value, not the array
		unit1PropertyId: units[1]?.propertyId,
		filteredCount: filteredUnits.length,
	});

	if (tenants.length === 0) {
		return (
			<div className="flex flex-col items-center gap-4 rounded-lg border border-dashed p-8 text-center">
				<div className="flex size-10 items-center justify-center rounded-full bg-muted">
					<IconAlertCircle className="size-5 text-muted-foreground" />
				</div>
				<div>
					<p className="font-medium text-sm">No tenants yet</p>
					<p className="mt-1 text-muted-foreground text-sm">
						You need to add a tenant before creating a lease.
					</p>
				</div>
				<div className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						nativeButton={false}
						render={<Link href="/tenants/invites" />}
					>
						Send Invite
					</Button>
					<Button
						size="sm"
						nativeButton={false}
						render={<Link href="/tenants/new" />}
					>
						<IconUserPlus className="mr-1 size-4" />
						Add Tenant
					</Button>
				</div>
			</div>
		);
	}

	return (
		<form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-6">
			<FieldSet>
				<FieldGroup className="flex flex-col gap-4">
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						{/* ── Property ────────────────────────────────────────── */}
						{initialPropertyId ? (
							// Property is pre-set (e.g. opened from /properties/[id] page)
							// Render as read-only — no need to re-select
							presetPropertyName && (
								<Field className="sm:col-span-2">
									<FieldLabel>Property</FieldLabel>
									<div className="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-muted-foreground text-sm">
										{presetPropertyName}
									</div>
								</Field>
							)
						) : (
							// Global context — owner must pick a property first to scope the units
							<Field className="sm:col-span-2">
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
												No properties yet — add one first
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

						{/* ── Unit ────────────────────────────────────────────── */}
						<Field data-invalid={!!errors.unitId}>
							<FieldLabel>Unit</FieldLabel>
							<Select
								value={watchedUnitId}
								onValueChange={(val) => {
									if (val) setValue("unitId", val, { shouldValidate: true });
								}}
								disabled={
									isSubmitting || (!initialPropertyId && !selectedPropertyId)
								}
							>
								<SelectTrigger>
									<SelectValue
										placeholder={
											!initialPropertyId && !selectedPropertyId
												? "Select a property first"
												: "Select a unit"
										}
									/>
								</SelectTrigger>
								<SelectContent>
									{filteredUnits.length === 0 ? (
										<SelectItem value="__empty__" disabled>
											{selectedPropertyId
												? "No available units in this property"
												: "Select a property first"}
										</SelectItem>
									) : (
										filteredUnits.map((unit) => (
											<SelectItem key={unit.id} value={unit.id}>
												Unit {unit.unitNumber} — {unit.propertyName}
											</SelectItem>
										))
									)}
								</SelectContent>
							</Select>
							<FieldError errors={[errors.unitId]} />
						</Field>

						{/* ── Tenant ──────────────────────────────────────────── */}
						<Field data-invalid={!!errors.tenantId}>
							<FieldLabel>Tenant</FieldLabel>
							<Select
								value={watchedTenantId}
								onValueChange={(val) => {
									if (val) setValue("tenantId", val, { shouldValidate: true });
								}}
								disabled={isSubmitting}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select a tenant" />
								</SelectTrigger>
								<SelectContent>
									{tenants.map((tenant) => (
										<SelectItem key={tenant.id} value={tenant.id}>
											{tenant.name} — {tenant.email}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<FieldError errors={[errors.tenantId]} />
						</Field>

						{/* ── Start Date ──────────────────────────────────────── */}
						<Field data-invalid={!!errors.startDate}>
							<FieldLabel htmlFor="startDate">Start Date</FieldLabel>
							<Input
								id="startDate"
								type="date"
								disabled={isSubmitting}
								{...register("startDate")}
							/>
							<FieldError errors={[errors.startDate]} />
						</Field>

						{/* ── End Date ────────────────────────────────────────── */}
						<Field data-invalid={!!errors.endDate}>
							<FieldLabel htmlFor="endDate">
								End Date{" "}
								<span className="text-muted-foreground text-xs">
									(optional)
								</span>
							</FieldLabel>
							<Input
								id="endDate"
								type="date"
								disabled={isSubmitting}
								{...register("endDate")}
							/>
							<FieldError errors={[errors.endDate]} />
						</Field>

						{/* ── Monthly Rent ─────────────────────────────────────── */}
						<Field data-invalid={!!errors.rent}>
							<FieldLabel htmlFor="rent">Monthly Rent (₹)</FieldLabel>
							<Input
								id="rent"
								type="number"
								placeholder="e.g. 12000"
								disabled={isSubmitting}
								{...register("rent")}
							/>
							<FieldError errors={[errors.rent]} />
						</Field>

						{/* ── Deposit ─────────────────────────────────────────── */}
						<Field data-invalid={!!errors.deposit}>
							<FieldLabel htmlFor="deposit">
								Deposit (₹){" "}
								<span className="text-muted-foreground text-xs">
									(optional)
								</span>
							</FieldLabel>
							<Input
								id="deposit"
								type="number"
								placeholder="e.g. 24000"
								disabled={isSubmitting}
								{...register("deposit")}
							/>
							<FieldError errors={[errors.deposit]} />
						</Field>
					</div>
				</FieldGroup>
			</FieldSet>

			{!formId && (
				<Button type="submit" disabled={isSubmitting} className="w-full">
					{isSubmitting ? "Saving..." : submitLabel}
				</Button>
			)}
		</form>
	);
}
