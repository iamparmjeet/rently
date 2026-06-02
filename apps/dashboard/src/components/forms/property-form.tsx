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
import { Textarea } from "@rently/ui/components/textarea";
import { CreatePropertySchema } from "@rently/validators";
import { useForm } from "react-hook-form";
import type { z } from "zod";

export type PropertyFormValues = z.infer<typeof CreatePropertySchema>;

interface PropertyFormProps {
	defaultValues?: Partial<PropertyFormValues>;
	onSubmit: (values: PropertyFormValues) => void;
	isSubmitting?: boolean;
	submitLabel?: string;
	formId?: string;
}

export function PropertyForm({
	defaultValues,
	onSubmit,
	isSubmitting,
	formId,
	submitLabel = "Save Property",
}: PropertyFormProps) {
	const {
		register,
		handleSubmit,
		setValue,
		watch,
		formState: { errors },
	} = useForm<PropertyFormValues>({
		resolver: zodResolver(CreatePropertySchema),
		defaultValues: {
			name: "",
			address: "",
			type: "residential",
			description: "",
			floors: "",
			totalArea: "",
			yearBuilt: "",
			...defaultValues,
		},
	});

	const typeValue = watch("type");

	return (
		<form id={formId} onSubmit={handleSubmit(onSubmit)}>
			<FieldSet>
				<FieldGroup className="flex flex-col gap-3">
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
						<Textarea
							id="address"
							placeholder="e.g. 123 Main Street, Ludhiana"
							disabled={isSubmitting}
							{...register("address")}
							aria-invalid={!!errors.address}
						/>
						<FieldError errors={[errors.address]} />
					</Field>
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
						{/* Year Built*/}
						<Field data-invalid={!!errors.yearBuilt}>
							<FieldLabel htmlFor="yearBuilt">Year Built</FieldLabel>
							<Input
								id="yearBuilt"
								type="number"
								min={1900}
								placeholder="2020"
								disabled={isSubmitting}
								{...register("yearBuilt")}
								aria-invalid={!!errors.yearBuilt}
							/>
							<FieldError errors={[errors.yearBuilt]} />
						</Field>
						{/* Total Area */}
						<Field data-invalid={!!errors.totalArea}>
							<FieldLabel htmlFor="totalArea">Total Area (sq ft)</FieldLabel>
							<Input
								id="totalArea"
								type="number"
								min={0}
								placeholder="2400"
								disabled={isSubmitting}
								{...register("totalArea")}
								aria-invalid={!!errors.totalArea}
							/>
							<FieldError errors={[errors.totalArea]} />
						</Field>
						<Field data-invalid={!!errors.floors}>
							<FieldLabel htmlFor="floors">Florrs</FieldLabel>
							<Input
								id="floors"
								type="number"
								min={1}
								placeholder="2"
								disabled={isSubmitting}
								{...register("floors")}
								aria-invalid={!!errors.floors}
							/>
							<FieldError errors={[errors.floors]} />
						</Field>
					</div>
					<Field data-invalid={!!errors.description}>
						<FieldLabel htmlFor="description">Description</FieldLabel>
						<Textarea
							id="description"
							placeholder="e.g. Any Additional Details about the property"
							disabled={isSubmitting}
							{...register("description")}
							aria-invalid={!!errors.description}
						/>
						<FieldError errors={[errors.description]} />
					</Field>
				</FieldGroup>
			</FieldSet>

			{!formId && ( // ← only show own button in standalone mode
				<Button type="submit" disabled={isSubmitting} className="w-full">
					{isSubmitting ? "Saving..." : submitLabel}
				</Button>
			)}
		</form>
	);
}
