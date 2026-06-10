// apps/dashboard/src/components/forms/tenant-profile-form.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@rently/ui/components/field";
import { Input } from "@rently/ui/components/input";
import { UpdateTenantProfileSchema } from "@rently/validators";
import { IconLock } from "@tabler/icons-react";
import { useForm } from "react-hook-form";
import z from "zod";

// WHY: We extend the base profile schema locally to include Better Auth
// user fields (name, email). These are NOT part of UpdateTenantProfileSchema
// because they live in the `user` table (owned by Better Auth), not
// `tenantProfiles`. The parent component is responsible for splitting
// onSubmit into two mutations:
//   1. profile fields (phone, address, emergency contact) → updateTenant procedure
//   2. name/email → auth.api.updateUser (Better Auth admin call)
// The form is "dumb" — it validates and returns all values, stays unaware
// of the two-mutation split.
const TenantProfileFormSchema = UpdateTenantProfileSchema.extend({
	name: z.string().min(1, { error: "Name is required" }),
	email: z.email("Invalid email"),
});

export type TenantProfileFormValues = z.infer<typeof TenantProfileFormSchema>;

// BREAKING CHANGE from previous version:
// `tenantName` and `tenantEmail` props are removed. They now come in
// via `defaultValues.name` and `defaultValues.email` since they're
// editable form fields, not display-only values.
interface TenantProfileFormProps {
	formId: string;
	defaultValues?: Partial<TenantProfileFormValues>;
	// Pass undefined to hide KYC section entirely.
	// Pass null to show it with "Not set" state.
	uidNumber?: string | null;
	panNumber?: string | null;
	onSubmit: (values: TenantProfileFormValues) => void;
	isSubmitting?: boolean;
}

// KYC-only locked field — requires document update request workflow.
// Kept separate from editable Better Auth fields on purpose: different
// unlock mechanism, different visual language.
function LockedField({
	label,
	value,
	note,
}: {
	label: string;
	value: string;
	note?: string;
}) {
	return (
		<Field>
			<FieldLabel className="flex items-center gap-1.5">
				{label}
				<span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
					<IconLock className="h-2.5 w-2.5" />
					{note ?? "Read-only"}
				</span>
			</FieldLabel>
			<Input
				value={value || "Not set"}
				disabled
				className="bg-muted/50 text-muted-foreground"
			/>
		</Field>
	);
}

export function TenantProfileForm({
	formId,
	defaultValues,
	uidNumber,
	panNumber,
	onSubmit,
	isSubmitting,
}: TenantProfileFormProps) {
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<TenantProfileFormValues>({
		resolver: zodResolver(TenantProfileFormSchema),
		defaultValues: {
			name: defaultValues?.name ?? "",
			email: defaultValues?.email ?? "",
			phone: defaultValues?.phone ?? undefined,
			address: defaultValues?.address ?? undefined,
			emergencyContact: defaultValues?.emergencyContact ?? undefined,
			emergencyContactName: defaultValues?.emergencyContactName ?? undefined,
			emergencyContactLocation:
				defaultValues?.emergencyContactLocation ?? undefined,
		},
	});

	return (
		<form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-6">
			{/*  Identity (Better Auth user table — editable)  */}
			<FieldSet>
				<FieldLegend className="flex items-center gap-2">Identity</FieldLegend>
				<FieldGroup className="grid grid-cols-2 gap-4">
					<Field data-invalid={!!errors.name}>
						<FieldLabel htmlFor="name">Full Name</FieldLabel>
						<Input
							id="name"
							placeholder="Ravi Kumar"
							disabled={isSubmitting}
							{...register("name")}
						/>
						<FieldError errors={[errors.name]} />
					</Field>

					<Field data-invalid={!!errors.email}>
						<FieldLabel htmlFor="email">Email</FieldLabel>
						<Input
							id="email"
							type="email"
							placeholder="ravi@example.com"
							disabled={isSubmitting}
							{...register("email")}
						/>
						<FieldError errors={[errors.email]} />
					</Field>
				</FieldGroup>
			</FieldSet>

			{/*  Contact Information  */}
			<FieldSet>
				<FieldLegend>Contact Information</FieldLegend>

				<FieldGroup className="grid grid-cols-2 gap-4">
					<Field data-invalid={!!errors.phone}>
						<FieldLabel htmlFor="phone">Phone</FieldLabel>
						<Input
							id="phone"
							type="tel"
							placeholder="+91 98989 98989"
							disabled={isSubmitting}
							{...register("phone")}
						/>
						<FieldError errors={[errors.phone]} />
					</Field>

					<Field data-invalid={!!errors.address} className="col-span-2">
						<FieldLabel htmlFor="address">Address</FieldLabel>
						<Input
							id="address"
							placeholder="123 Main Street, City, State"
							disabled={isSubmitting}
							{...register("address")}
						/>
						<FieldError errors={[errors.address]} />
					</Field>
				</FieldGroup>
			</FieldSet>

			{/*  Emergency Contact  */}
			<FieldSet>
				<FieldLegend>Emergency Contact</FieldLegend>
				<FieldGroup className="grid grid-cols-2 gap-4">
					<Field data-invalid={!!errors.emergencyContactName}>
						<FieldLabel htmlFor="emergencyContactName">Contact Name</FieldLabel>
						<Input
							id="emergencyContactName"
							placeholder="Parent / Spouse / Sibling"
							disabled={isSubmitting}
							{...register("emergencyContactName")}
						/>
						<FieldError errors={[errors.emergencyContactName]} />
					</Field>

					<Field data-invalid={!!errors.emergencyContact}>
						<FieldLabel htmlFor="emergencyContact">Contact Phone</FieldLabel>
						<Input
							id="emergencyContact"
							type="tel"
							placeholder="+91 99999 99999"
							disabled={isSubmitting}
							{...register("emergencyContact")}
						/>
						<FieldError errors={[errors.emergencyContact]} />
					</Field>

					<Field
						data-invalid={!!errors.emergencyContactLocation}
						className="col-span-2"
					>
						<FieldLabel htmlFor="emergencyContactLocation">
							Contact Location
						</FieldLabel>
						<Input
							id="emergencyContactLocation"
							placeholder="City, State"
							disabled={isSubmitting}
							{...register("emergencyContactLocation")}
						/>
						<FieldError errors={[errors.emergencyContactLocation]} />
					</Field>
				</FieldGroup>
			</FieldSet>

			{/* ── KYC Documents (still locked — document request workflow) ── */}
			{(uidNumber !== undefined || panNumber !== undefined) && (
				<FieldSet>
					<FieldLegend>KYC Documents</FieldLegend>
					<p className="mb-3 text-muted-foreground text-xs">
						To change these fields, raise a document update request from the
						tenant detail page.
					</p>
					<FieldGroup className="grid grid-cols-2 gap-4">
						{uidNumber !== undefined && (
							<LockedField
								label="Aadhaar / UID Number"
								value={uidNumber ?? ""}
								note="Requires document request"
							/>
						)}
						{panNumber !== undefined && (
							<LockedField
								label="PAN Number"
								value={panNumber ?? ""}
								note="Requires document request"
							/>
						)}
					</FieldGroup>
				</FieldSet>
			)}
		</form>
	);
}
