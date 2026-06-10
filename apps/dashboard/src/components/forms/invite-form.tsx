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
import { Textarea } from "@rently/ui/components/textarea";
import { CreateInviteSchema } from "@rently/validators";
import { useForm } from "react-hook-form";
import type { z } from "zod";

export type InviteFormValues = z.infer<typeof CreateInviteSchema>;

interface InviteFormProps {
	// WHY formId: FormDialog's footer "Send Invite" button submits the form via
	// form={formId}. The form must have a matching id={formId} on the <form>
	// element. Removes the need for an internal submit button.
	formId: string;
	defaultValues?: Partial<InviteFormValues>;
	onSubmit: (values: InviteFormValues) => void;
	isSubmitting?: boolean;
}

export function InviteForm({
	formId,
	defaultValues,
	onSubmit,
	isSubmitting,
}: InviteFormProps) {
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<InviteFormValues>({
		resolver: zodResolver(CreateInviteSchema),
		defaultValues: {
			notes: "",
			...defaultValues,
		},
	});

	return (
		// WHY id={formId}: connects this form to the FormDialog footer button via
		// the HTML `form` attribute — no prop drilling needed.
		<form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-6">
			<FieldSet>
				<FieldLegend>Tenant Details</FieldLegend>

				<FieldGroup className="flex flex-col gap-4">
					<Field data-invalid={!!errors.name}>
						<FieldLabel htmlFor="name">Tenant Name</FieldLabel>
						<Input
							id="name"
							placeholder="e.g. Rajesh Kumar"
							disabled={isSubmitting}
							{...register("name")}
							aria-invalid={!!errors.name}
						/>
						<FieldError errors={[errors.name]} />
					</Field>

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

					<Field data-invalid={!!errors.emergencyContact}>
						<FieldLabel htmlFor="emergencyContact">
							Emergency Contact
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

					<Field data-invalid={!!errors.notes}>
						<FieldLabel htmlFor="notes">Private Notes</FieldLabel>
						<Textarea
							id="notes"
							placeholder="Notes visible only to you"
							disabled={isSubmitting}
							{...register("notes")}
							aria-invalid={!!errors.notes}
						/>
						<FieldError errors={[errors.notes]} />
					</Field>
				</FieldGroup>
			</FieldSet>
		</form>
	);
}
