"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
	UNIT_FURNISHING_VALUES,
	UNIT_TYPES_VALUES,
	type UnitFurnishing,
	type UnitType,
} from "@rently/db/constants/rent-constants";
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
import { type CreateUnit, CreateUnitSchema } from "@rently/validators";
import { useForm } from "react-hook-form";

// Schema
interface UnitFormProps {
	formId?: string;
	propertyId?: string;
	properties?: { id: string; name: string }[];
	defaultValues?: Partial<CreateUnit>;
	onSubmit: (values: CreateUnit) => void;
	isSubmitting?: boolean;
	submitLabel?: string;
	showStatus?: boolean;
}

const FURNISHING_LABELS: Record<UnitFurnishing, string> = {
	unfurnished: "🛏 Unfurnished",
	semi_furnished: "🪑 Semi-Furnished",
	fully_furnished: "🛋 Fully Furnished",
};

const UNIT_TYPE_LABELS: Record<UnitType, string> = {
	studio: "🏠 Studio",
	shop: "🏪 Shop (Commercial)",
	"1BHK": "🛏 1 BHK",
	"2BHK": "🛏🛏 2 BHK",
	"3BHK": "🏡 3 BHK",
	"4BHK": "🏘 4 BHK",
};

export function UnitForm({
	propertyId,
	properties = [],
	defaultValues,
	onSubmit,
	isSubmitting,
	formId,
	submitLabel = "Save Unit",
}: UnitFormProps) {
	const {
		register,
		handleSubmit,
		setValue,
		watch,
		formState: { errors },
	} = useForm<CreateUnit>({
		resolver: zodResolver(CreateUnitSchema),
		defaultValues: {
			propertyId: propertyId ?? "",
			unitNumber: "",
			baseRent: 0,
			area: null,
			description: null,
			furnishing: "unfurnished",
			type: UNIT_TYPES_VALUES[0],
			...defaultValues,
		},
	});

	// const { data } = useSuspenseProperties();
	// const properties = data?.properties ?? [];

	const typeValue = watch("type");
	const furnishingValue = watch("furnishing");
	const selectedPropertyId = watch("propertyId");
	const selectedProperty = properties.find((p) => p.id === selectedPropertyId);

	return (
		<form onSubmit={handleSubmit(onSubmit)} id={formId} className="space-y-6">
			<FieldSet>
				<FieldGroup className="flex flex-col gap-4">
					{/* Property selector — only shown when propertyId is NOT injected */}
					{!propertyId && (
						<Field data-invalid={!!errors.propertyId}>
							<FieldLabel htmlFor="propertyId">Property</FieldLabel>
							<Select
								value={selectedPropertyId}
								onValueChange={(val) =>
									setValue("propertyId", val as CreateUnit["propertyId"], {
										shouldValidate: true,
									})
								}
								disabled={isSubmitting}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select type">
										{selectedProperty?.name}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{properties.map((p) => (
										<SelectItem key={p.id} value={p.id}>
											{p.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							<FieldError errors={[errors.propertyId]} />
						</Field>
					)}
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
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						{/* Type */}
						<Field data-invalid={!!errors.type}>
							<FieldLabel>Unit Type</FieldLabel>
							<Select
								value={typeValue}
								onValueChange={(val) =>
									setValue("type", val as CreateUnit["type"], {
										shouldValidate: true,
									})
								}
								disabled={isSubmitting}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select type" />
								</SelectTrigger>
								<SelectContent className="capitalize">
									{UNIT_TYPES_VALUES.map((t) => (
										<SelectItem key={t} value={t} className="capitalize">
											{UNIT_TYPE_LABELS[t] ?? t}
										</SelectItem>
									))}
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
								<span className="text-muted-foreground text-xs">
									— optional
								</span>
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
										v === "" || v === null || v === undefined
											? null
											: Number(v),
								})}
							/>
							<FieldError errors={[errors.area]} />
						</Field>

						{/* Furnishing */}
						<Field data-invalid={!!errors.furnishing}>
							<FieldLabel>
								Furnishing{" "}
								<span className="text-muted-foreground text-xs">
									— optional
								</span>
							</FieldLabel>
							<Select
								// WHY: value must be string for Select — undefined means no selection
								value={furnishingValue ?? ""}
								onValueChange={(val) =>
									setValue(
										"furnishing",
										// WHY: empty string means the user cleared the selection
										// — map back to undefined so Zod sees it as "not provided"
										(val === "" ? undefined : val) as CreateUnit["furnishing"],
										{ shouldValidate: true },
									)
								}
								disabled={isSubmitting}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select furnishing status" />
								</SelectTrigger>
								<SelectContent>
									{UNIT_FURNISHING_VALUES.map((f) => (
										<SelectItem key={f} value={f}>
											{FURNISHING_LABELS[f] ?? f}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<FieldError errors={[errors.furnishing]} />
						</Field>
					</div>
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
			{!formId && (
				<Button
					type="submit"
					disabled={isSubmitting}
					className="w-full cursor-pointer"
				>
					{isSubmitting ? "Saving..." : submitLabel}
				</Button>
			)}
		</form>
	);
}
