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
import { Textarea } from "@rently/ui/components/textarea";
import { CreateInviteSchema } from "@rently/validators";
import { useForm } from "react-hook-form";
import type { z } from "zod";

export type InviteFormValues = z.infer<typeof CreateInviteSchema>;

interface InviteFormProps {
	defaultValues?: Partial<InviteFormValues>;
	onSubmit: (values: InviteFormValues) => void;
	isSubmitting?: boolean;
	submitLabel?: string;
}

export function InviteForm({
	defaultValues,
	onSubmit,
	isSubmitting,
	submitLabel = "Save Tenant",
}: InviteFormProps) {
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<InviteFormValues>({
		resolver: zodResolver(CreateInviteSchema),
		defaultValues: {
			notes: "", // Private Note for owner
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

					{/* private note for owner */}
					<Field data-invalid={!!errors.notes}>
						<FieldLabel htmlFor="notes">Notes</FieldLabel>
						<Textarea
							id="notes"
							placeholder="Private Note for Owner"
							disabled={isSubmitting}
							{...register("notes")}
							aria-invalid={!!errors.notes}
						/>
						<FieldError errors={[errors.notes]} />
					</Field>
				</FieldGroup>
			</FieldSet>

			<Button type="submit" disabled={isSubmitting} className="w-full">
				{isSubmitting ? "Saving..." : submitLabel}
			</Button>
		</form>
	);
}
