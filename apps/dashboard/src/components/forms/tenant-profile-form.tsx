// apps/web/src/components/forms/tenant-profile-form.tsx
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
import { UpdateTenantProfileSchema } from "@rently/validators";
import { IconLock } from "@tabler/icons-react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

// The form values are exactly UpdateTenantProfileSchema
// We don't add name/email here — those are Better Auth identity fields
// and changing them requires a separate secure flow (future scope)
export type TenantProfileFormValues = z.infer<typeof UpdateTenantProfileSchema>;

interface TenantProfileFormProps {
	defaultValues?: Partial<TenantProfileFormValues>;
	// Read-only identity fields shown for context (from user table)
	tenantName: string;
	tenantEmail: string;
	// Locked KYC fields — shown as read-only with badge
	uidNumber?: string | null;
	panNumber?: string | null;
	onSubmit: (values: TenantProfileFormValues) => void;
	isSubmitting?: boolean;
	submitLabel?: string;
}

// A small display-only field with a "locked" visual indicator
function LockedInfoField({
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
	defaultValues,
	tenantName,
	tenantEmail,
	uidNumber,
	panNumber,
	onSubmit,
	isSubmitting,
	submitLabel = "Save Changes",
}: TenantProfileFormProps) {
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<TenantProfileFormValues>({
		resolver: zodResolver(UpdateTenantProfileSchema),
		defaultValues: {
			phone: defaultValues?.phone ?? undefined,
			address: defaultValues?.address ?? undefined,
			emergencyContact: defaultValues?.emergencyContact ?? undefined,
			emergencyContactName: defaultValues?.emergencyContactName ?? undefined,
			emergencyContactLocation:
				defaultValues?.emergencyContactLocation ?? undefined,
		},
	});

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
			{/* ── Identity (read-only) ────────────────────────────────── */}
			<FieldSet>
				<FieldLegend>Identity</FieldLegend>
				<FieldGroup className="flex flex-col gap-4">
					<LockedInfoField
						label="Full Name"
						value={tenantName}
						note="Set by Better Auth"
					/>
					<LockedInfoField
						label="Email"
						value={tenantEmail}
						note="Set by Better Auth"
					/>
				</FieldGroup>
			</FieldSet>

			{/* ── Contact Info (editable) ─────────────────────────────── */}
			<FieldSet>
				<FieldLegend>Contact Information</FieldLegend>
				<FieldGroup className="flex flex-col gap-4">
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

					<Field data-invalid={!!errors.address}>
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

			{/* ── Emergency Contact (editable) ────────────────────────── */}
			<FieldSet>
				<FieldLegend>Emergency Contact</FieldLegend>
				<FieldGroup className="flex flex-col gap-4">
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

					<Field data-invalid={!!errors.emergencyContactLocation}>
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

			{/* ── KYC Documents (locked — document request flow) ─────── */}
			{(uidNumber !== undefined || panNumber !== undefined) && (
				<FieldSet>
					<FieldLegend>KYC Documents</FieldLegend>
					<p className="mb-3 text-muted-foreground text-xs">
						To change these fields, raise a document update request from the
						tenant detail page.
					</p>
					<FieldGroup className="flex flex-col gap-4">
						{uidNumber !== undefined && (
							<LockedInfoField
								label="Aadhaar / UID Number"
								value={uidNumber ?? ""}
								note="Requires document request"
							/>
						)}
						{panNumber !== undefined && (
							<LockedInfoField
								label="PAN Number"
								value={panNumber ?? ""}
								note="Requires document request"
							/>
						)}
					</FieldGroup>
				</FieldSet>
			)}

			<Button type="submit" disabled={isSubmitting} className="w-full">
				{isSubmitting ? "Saving..." : submitLabel}
			</Button>
		</form>
	);
}
