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

interface InviteFormProps {
	defaultValues?: Partial<TenantCreateFormValues>;
	onSubmit: (values: TenantCreateFormValues) => void;
	isSubmitting?: boolean;
	submitLabel?: string;
}

export function TenantCreateForm({
	defaultValues,
	onSubmit,
	isSubmitting,
	submitLabel = "Save Tenant",
}: InviteFormProps) {
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<TenantCreateFormValues>({
		resolver: zodResolver(CreateTenantSchema),
		defaultValues: {
			...defaultValues,
		},
	});

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
			<FieldSet>
				<FieldLegend>Tenant Details</FieldLegend>

				<FieldGroup className="flex flex-col gap-4">
					{/* Name */}
					<Field data-invalid={!!errors.name}>
						<FieldLabel htmlFor="name">Tenant Name</FieldLabel>
						<Input
							id="name"
							placeholder="e.g. Green Valley Apartments"
							disabled={isSubmitting}
							{...register("name")}
							aria-invalid={!!errors.name}
						/>
						<FieldError errors={[errors.name]} />
					</Field>

					{/* email */}
					<Field data-invalid={!!errors.email}>
						<FieldLabel htmlFor="email">Email</FieldLabel>
						<Input
							id="email"
							type="email"
							placeholder="info@example.com"
							disabled={isSubmitting}
							{...register("email")}
							aria-invalid={!!errors.email}
						/>
						<FieldError errors={[errors.email]} />
					</Field>

					{/* Address */}
					<Field data-invalid={!!errors.address}>
						<FieldLabel htmlFor="address">Address</FieldLabel>
						<Input
							id="address"
							type="text"
							placeholder="221B - Baker Street"
							disabled={isSubmitting}
							{...register("address")}
							aria-invalid={!!errors.address}
						/>
						<FieldError errors={[errors.address]} />
					</Field>

					{/* phone */}
					<Field data-invalid={!!errors.phone}>
						<FieldLabel htmlFor="phone">Phone</FieldLabel>
						<Input
							id="phone"
							type="tel"
							placeholder="1231-123-123"
							disabled={isSubmitting}
							{...register("phone")}
							aria-invalid={!!errors.phone}
						/>
						<FieldError errors={[errors.phone]} />
					</Field>

					{/* emergencyContactName */}
					<Field data-invalid={!!errors.emergencyContactName}>
						<FieldLabel htmlFor="emergencyContactName">
							Emergency Contact Name
						</FieldLabel>
						<Input
							id="emergencyContactName"
							type="text"
							placeholder="Mr Ajay is buddy"
							disabled={isSubmitting}
							{...register("emergencyContactName")}
							aria-invalid={!!errors.emergencyContactName}
						/>
						<FieldError errors={[errors.emergencyContactName]} />
					</Field>

					{/* emergencyContact */}
					<Field data-invalid={!!errors.emergencyContact}>
						<FieldLabel htmlFor="emergencyContact">
							Emergency Contact
						</FieldLabel>
						<Input
							id="emergencyContact"
							type="tel"
							placeholder="1231-123-123"
							disabled={isSubmitting}
							{...register("emergencyContact")}
							aria-invalid={!!errors.emergencyContact}
						/>
						<FieldError errors={[errors.emergencyContact]} />
					</Field>

					{/* emergencyContactLocation */}
					<Field data-invalid={!!errors.emergencyContactLocation}>
						<FieldLabel htmlFor="emergencyContactLocation">
							Emergency Contact Location
						</FieldLabel>
						<Input
							id="emergencyContactLocation"
							type="text"
							placeholder="Location and Relation with emergency contact"
							disabled={isSubmitting}
							{...register("emergencyContactLocation")}
							aria-invalid={!!errors.emergencyContactLocation}
						/>
						<FieldError errors={[errors.emergencyContactLocation]} />
					</Field>

					{/* panNumber */}
					<Field data-invalid={!!errors.panNumber}>
						<FieldLabel htmlFor="panNumber">PAN Number</FieldLabel>
						<Input
							id="panNumber"
							type="text"
							placeholder="PAN Number"
							disabled={isSubmitting}
							{...register("panNumber")}
							aria-invalid={!!errors.panNumber}
						/>
						<FieldError errors={[errors.panNumber]} />
					</Field>

					{/* uid */}
					<Field data-invalid={!!errors.uidNumber}>
						<FieldLabel htmlFor="uidNumber">UID/Aadhar Number</FieldLabel>
						<Input
							id="uidNumber"
							type="text"
							placeholder="UID / Aadhar Number"
							disabled={isSubmitting}
							{...register("uidNumber")}
							aria-invalid={!!errors.uidNumber}
						/>
						<FieldError errors={[errors.uidNumber]} />
					</Field>
				</FieldGroup>
			</FieldSet>

			<Button type="submit" disabled={isSubmitting} className="w-full">
				{isSubmitting ? "Saving..." : submitLabel}
			</Button>
		</form>
	);
}
