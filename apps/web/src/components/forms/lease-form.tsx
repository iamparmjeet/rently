// apps/web/src/components/forms/lease-form.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@rently/ui/components/button";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
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
import { CreateLeaseSchema } from "@rently/validators/lease";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import z from "zod";

// Form-specific schema — dates as strings (HTML date input returns strings)
const LeaseFormSchema = CreateLeaseSchema.safeExtend({
	startDate: z.string().min(1, "Start date is required"),
	endDate: z.string().optional(),
	rent: z.coerce.number().min(1, "Rent must be greater than 0"),
	deposit: z.coerce.number().optional(),
});

export type LeaseFormValues = z.infer<typeof LeaseFormSchema>;

interface UnitOption {
	id: string;
	unitNumber: string;
	propertyName: string;
	baseRent: number;
}

interface TenantOption {
	id: string;
	name: string;
	email: string;
}

interface LeaseFormProps {
	units: UnitOption[];
	tenants: TenantOption[];
	defaultValues?: Partial<LeaseFormValues>;
	onSubmit: (values: LeaseFormValues) => void;
	isSubmitting?: boolean;
	submitLabel?: string;
}

export function LeaseForm({
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
		resolver: zodResolver(LeaseFormSchema),
		defaultValues: {
			status: "active",
			...defaultValues,
		},
	});

	const selectedUnitId = watch("unitId");

	// Auto-fill rent when unit is selected
	useEffect(() => {
		const unit = units.find((u) => u.id === selectedUnitId);
		if (unit) {
			setValue("rent", unit.baseRent, { shouldValidate: true });
		}
	}, [selectedUnitId, units, setValue]);

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
			<FieldSet>
				<FieldLegend>Lease Details</FieldLegend>
				<FieldGroup className="flex flex-col gap-4">
					{/* Unit */}
					<Field data-invalid={!!errors.unitId}>
						<FieldLabel>Unit</FieldLabel>
						<Select
							defaultValue={defaultValues?.unitId}
							onValueChange={(val) =>
								setValue("unitId", val, { shouldValidate: true })
							}
							disabled={isSubmitting}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select a unit" />
							</SelectTrigger>
							<SelectContent>
								{units.map((unit) => (
									<SelectItem key={unit.id} value={unit.id}>
										Unit {unit.unitNumber} — {unit.propertyName}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<FieldError errors={[errors.unitId]} />
					</Field>

					{/* Tenant */}
					<Field data-invalid={!!errors.tenantId}>
						<FieldLabel>Tenant</FieldLabel>
						<Select
							defaultValue={defaultValues?.tenantId}
							onValueChange={(val) =>
								setValue("tenantId", val, { shouldValidate: true })
							}
							disabled={isSubmitting}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select a tenant" />
							</SelectTrigger>
							<SelectContent>
								{tenants.length === 0 ? (
									<SelectItem value="none" disabled>
										No tenants yet — invite one first
									</SelectItem>
								) : (
									tenants.map((tenant) => (
										<SelectItem key={tenant.id} value={tenant.id}>
											{tenant.name} — {tenant.email}
										</SelectItem>
									))
								)}
							</SelectContent>
						</Select>
						<FieldError errors={[errors.tenantId]} />
					</Field>

					{/* Dates */}
					<div className="grid grid-cols-2 gap-4">
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
					</div>

					{/* Rent + Deposit */}
					<div className="grid grid-cols-2 gap-4">
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

					{/* Status */}
					<Field data-invalid={!!errors.status}>
						<FieldLabel>Status</FieldLabel>
						<Select
							defaultValue={defaultValues?.status ?? "active"}
							onValueChange={(val) =>
								setValue("status", val as LeaseFormValues["status"], {
									shouldValidate: true,
								})
							}
							disabled={isSubmitting}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="active">Active</SelectItem>
								<SelectItem value="expired">Expired</SelectItem>
								<SelectItem value="terminated">Terminated</SelectItem>
							</SelectContent>
						</Select>
						<FieldError errors={[errors.status]} />
					</Field>
				</FieldGroup>
			</FieldSet>

			<Button type="submit" disabled={isSubmitting} className="w-full">
				{isSubmitting ? "Saving..." : submitLabel}
			</Button>
		</form>
	);
}
