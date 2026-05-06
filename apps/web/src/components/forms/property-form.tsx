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
import { useForm } from "react-hook-form";
import { z } from "zod";

// Schema
const propertyFormSchema = z.object({
	name: z.string().min(1, "Name is required"),
	address: z.string().min(5, "Address must be at least 5 characters"),
	type: z.enum(["residential", "commercial"]),
});

export type PropertyFormValues = z.infer<typeof propertyFormSchema>;

interface PropertyFormProps {
	defaultValues?: Partial<PropertyFormValues>;
	onSubmit: (values: PropertyFormValues) => void;
	isSubmitting?: boolean;
	submitLabel?: string;
}

export function PropertyForm({
	defaultValues,
	onSubmit,
	isSubmitting,
	submitLabel = "Save Property",
}: PropertyFormProps) {
	const {
		register,
		handleSubmit,
		setValue,
		watch,
		formState: { errors },
	} = useForm<PropertyFormValues>({
		resolver: zodResolver(propertyFormSchema),
		defaultValues: {
			name: "",
			address: "",
			type: "residential",
			...defaultValues,
		},
	});

	const typeValue = watch("type");

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
			<FieldSet>
				<FieldLegend>Property Details</FieldLegend>

				<FieldGroup className="flex flex-col gap-4">
					{/* Name */}
					<Field data-invalid={!!errors.name}>
						<FieldLabel htmlFor="name">Property Name</FieldLabel>
						<Input
							id="name"
							placeholder="e.g. Green Valley Apartments"
							disabled={isSubmitting}
							{...register("name")}
							aria-invalid={!!errors.name}
						/>
						<FieldError errors={[errors.name]} />
					</Field>

					{/* Address */}
					<Field data-invalid={!!errors.address}>
						<FieldLabel htmlFor="address">Address</FieldLabel>
						<Input
							id="address"
							placeholder="e.g. 123 Main Street, Ludhiana"
							disabled={isSubmitting}
							{...register("address")}
							aria-invalid={!!errors.address}
						/>
						<FieldError errors={[errors.address]} />
					</Field>

					{/* Type */}
					<Field data-invalid={!!errors.type}>
						<FieldLabel>Property Type</FieldLabel>

						<Select
							value={typeValue}
							onValueChange={(val) =>
								setValue("type", val as PropertyFormValues["type"], {
									shouldValidate: true,
								})
							}
							disabled={isSubmitting}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select type" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="residential">Residential</SelectItem>
								<SelectItem value="commercial">Commercial</SelectItem>
							</SelectContent>
						</Select>

						<FieldError errors={[errors.type]} />
					</Field>
				</FieldGroup>
			</FieldSet>

			<Button type="submit" disabled={isSubmitting} className="w-full">
				{isSubmitting ? "Saving..." : submitLabel}
			</Button>
		</form>
	);
}
