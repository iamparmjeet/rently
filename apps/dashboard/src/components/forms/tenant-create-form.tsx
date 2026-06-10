// apps/dashboard/src/components/forms/tenant-create-form.tsx
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
import { CreateTenantSchema } from "@rently/validators";
import { useForm } from "react-hook-form";
import type { z } from "zod";

export type TenantCreateFormValues = z.infer<typeof CreateTenantSchema>;

interface TenantCreateFormProps {
	defaultValues?: Partial<TenantCreateFormValues>;
	onSubmit: (values: TenantCreateFormValues) => void;
	isSubmitting?: boolean;
	submitLabel?: string;
	formId: string;
}

export function TenantCreateForm({
	defaultValues,
	onSubmit,
	isSubmitting,
	formId,
	submitLabel = "Save Tenant",
}: TenantCreateFormProps) {
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<TenantCreateFormValues>({
		resolver: zodResolver(CreateTenantSchema),
		defaultValues: { ...defaultValues },
	});

	return (
		<form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-6">
			<FieldSet>
				<FieldLegend>Tenant Details</FieldLegend>

				<FieldGroup className="flex flex-col gap-4">
					{/* Full width — primary identifier */}
					<Field data-invalid={!!errors.name}>
						<FieldLabel htmlFor="name">Full Name</FieldLabel>
						<Input
							id="name"
							placeholder="e.g. Rajesh Kumar"
							disabled={isSubmitting}
							{...register("name")}
							aria-invalid={!!errors.name}
						/>
						<FieldError errors={[errors.name]} />
					</Field>

					{/* Row: contact methods */}
					<div className="grid grid-cols-2 gap-4">
						<Field data-invalid={!!errors.email}>
							<FieldLabel htmlFor="email">Email</FieldLabel>
							<Input
								id="email"
								type="email"
								placeholder="rajesh@example.com"
								disabled={isSubmitting}
								{...register("email")}
								aria-invalid={!!errors.email}
							/>
							<FieldError errors={[errors.email]} />
						</Field>

						<Field data-invalid={!!errors.phone}>
							<FieldLabel htmlFor="phone">Phone</FieldLabel>
							<Input
								id="phone"
								type="tel"
								placeholder="98765 43210"
								disabled={isSubmitting}
								{...register("phone")}
								aria-invalid={!!errors.phone}
							/>
							<FieldError errors={[errors.phone]} />
						</Field>
					</div>

					{/* Full width — needs room for full address */}
					<Field data-invalid={!!errors.address}>
						<FieldLabel htmlFor="address">Address</FieldLabel>
						<Input
							id="address"
							placeholder="221B Baker Street"
							disabled={isSubmitting}
							{...register("address")}
							aria-invalid={!!errors.address}
						/>
						<FieldError errors={[errors.address]} />
					</Field>

					{/* Row: emergency contact name + phone */}
					<div className="grid grid-cols-2 gap-4">
						<Field data-invalid={!!errors.emergencyContactName}>
							<FieldLabel htmlFor="emergencyContactName">
								Emergency Contact Name
							</FieldLabel>
							<Input
								id="emergencyContactName"
								placeholder="e.g. Suresh Kumar"
								disabled={isSubmitting}
								{...register("emergencyContactName")}
								aria-invalid={!!errors.emergencyContactName}
							/>
							<FieldError errors={[errors.emergencyContactName]} />
						</Field>

						<Field data-invalid={!!errors.emergencyContact}>
							<FieldLabel htmlFor="emergencyContact">
								Emergency Contact Phone
							</FieldLabel>
							<Input
								id="emergencyContact"
								type="tel"
								placeholder="98765 00000"
								disabled={isSubmitting}
								{...register("emergencyContact")}
								aria-invalid={!!errors.emergencyContact}
							/>
							<FieldError errors={[errors.emergencyContact]} />
						</Field>
					</div>

					{/* Full width — free-form location/relation text */}
					<Field data-invalid={!!errors.emergencyContactLocation}>
						<FieldLabel htmlFor="emergencyContactLocation">
							Emergency Contact Location
						</FieldLabel>
						<Input
							id="emergencyContactLocation"
							placeholder="Relation and address"
							disabled={isSubmitting}
							{...register("emergencyContactLocation")}
							aria-invalid={!!errors.emergencyContactLocation}
						/>
						<FieldError errors={[errors.emergencyContactLocation]} />
					</Field>

					{/* Row: identity documents */}
					<div className="grid grid-cols-2 gap-4">
						<Field data-invalid={!!errors.panNumber}>
							<FieldLabel htmlFor="panNumber">PAN Number</FieldLabel>
							<Input
								id="panNumber"
								placeholder="ABCDE1234F"
								disabled={isSubmitting}
								{...register("panNumber")}
								aria-invalid={!!errors.panNumber}
							/>
							<FieldError errors={[errors.panNumber]} />
						</Field>

						<Field data-invalid={!!errors.uidNumber}>
							<FieldLabel htmlFor="uidNumber">UID / Aadhar Number</FieldLabel>
							<Input
								id="uidNumber"
								placeholder="1234 5678 9012"
								disabled={isSubmitting}
								{...register("uidNumber")}
								aria-invalid={!!errors.uidNumber}
							/>
							<FieldError errors={[errors.uidNumber]} />
						</Field>
					</div>
				</FieldGroup>
			</FieldSet>

			<Button type="submit" disabled={isSubmitting} className="w-full">
				{isSubmitting ? "Saving..." : submitLabel}
			</Button>
		</form>
	);
}
