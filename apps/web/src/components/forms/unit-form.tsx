"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UNIT_TYPES_VALUES } from "@rently/db/constants/rent-constants";
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
import { CreateUnitSchema } from "@rently/validators";
import { useForm } from "react-hook-form";
import type { z } from "zod";

// Schema
export type UnitFormValues = z.infer<typeof CreateUnitSchema>;

interface UnitFormProps {
	propertyId: string;
	defaultValues?: Partial<UnitFormValues>;
	onSubmit: (values: UnitFormValues) => void;
	isSubmitting?: boolean;
	submitLabel?: string;
	showStatus?: boolean;
}

export function UnitForm({
	propertyId,
	defaultValues,
	onSubmit,
	isSubmitting,
	submitLabel = "Save Unit",
}: UnitFormProps) {
	const {
		register,
		handleSubmit,
		setValue,
		watch,
		formState: { errors },
	} = useForm<UnitFormValues>({
		resolver: zodResolver(CreateUnitSchema),
		defaultValues: {
			propertyId,
			unitNumber: "",
			baseRent: 0,
			area: null,
			description: null,
			type: UNIT_TYPES_VALUES[0],
			...defaultValues,
		},
	});

	const typeValue = watch("type");

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
			<FieldSet>
				<FieldLegend>Unit Details</FieldLegend>

				<FieldGroup className="flex flex-col gap-4">
					{/* Name */}
					<Field data-invalid={!!errors.unitNumber}>
						<FieldLabel htmlFor="unitNumber">Unit Name / Number</FieldLabel>
						<Input
							id="unitNumber"
							placeholder="e.g. A-101, Shop-2, Ground Floor Left"
							disabled={isSubmitting}
							{...register("unitNumber")}
							aria-invalid={!!errors.unitNumber}
						/>
						<FieldError errors={[errors.unitNumber]} />
					</Field>

					{/* Type */}
					<Field data-invalid={!!errors.type}>
						<FieldLabel>Unit Type</FieldLabel>
						<Select
							value={typeValue}
							onValueChange={(val) =>
								setValue("type", val as UnitFormValues["type"], {
									shouldValidate: true,
								})
							}
							disabled={isSubmitting}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select type" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="room">🏠 Room (Residential)</SelectItem>
								<SelectItem value="shop">🏪 Shop (Commercial)</SelectItem>
							</SelectContent>
						</Select>

						<FieldError errors={[errors.type]} />
					</Field>

					{/* Base Rent */}
					<Field data-invalid={!!errors.baseRent}>
						<FieldLabel htmlFor="baseRent">Base Rent</FieldLabel>
						<Input
							id="baseRent"
							type="number"
							min={0}
							step={50}
							placeholder="e.g. 1500"
							disabled={isSubmitting}
							{...register("baseRent", { valueAsNumber: true })}
							aria-invalid={!!errors.baseRent}
						/>
						<FieldError errors={[errors.baseRent]} />
					</Field>

					{/* Area — optional, nullable in DB */}
					<Field data-invalid={!!errors.area}>
						<FieldLabel htmlFor="area">
							Area (sq ft){" "}
							<span className="text-muted-foreground text-xs">— optional</span>
						</FieldLabel>
						<Input
							id="area"
							type="number"
							min={0}
							placeholder="e.g. 450"
							disabled={isSubmitting}
							// setValueAs: converts empty string → null (DB nullable field)
							{...register("area", {
								setValueAs: (v) =>
									v === "" || v === null || v === undefined ? null : Number(v),
							})}
						/>
						<FieldError errors={[errors.area]} />
					</Field>
					{/* Description — optional */}
					<Field data-invalid={!!errors.description}>
						<FieldLabel htmlFor="description">
							Description{" "}
							<span className="text-muted-foreground text-xs">— optional</span>
						</FieldLabel>
						<Input
							id="description"
							placeholder="e.g. Corner room with attached bathroom"
							disabled={isSubmitting}
							{...register("description", {
								setValueAs: (v) => (v === "" ? null : v),
							})}
						/>
						<FieldError errors={[errors.description]} />
					</Field>
				</FieldGroup>
			</FieldSet>

			<Button
				type="submit"
				disabled={isSubmitting}
				className="w-full cursor-pointer"
			>
				{isSubmitting ? "Saving..." : submitLabel}
			</Button>
		</form>
	);
}
