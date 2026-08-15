"use client";

import { Badge } from "@rently/ui/components/badge";
import { Button } from "@rently/ui/components/button";
import { EmptyState } from "@rently/ui/shared/empty-state";
import { FormDialog, useFormDialog } from "@rently/ui/shared/form-dialog";
import { IconWrapper } from "@rently/ui/shared/icon-wrapper";
import type { CreateUnit, UnitWithLease } from "@rently/validators";
import {
	IconBuilding,
	IconCalendar,
	IconChevronLeft,
	IconHome2,
	IconLayout,
	IconPencil,
	IconPlus,
	IconRuler2,
	IconUsers,
} from "@tabler/icons-react";
import Link from "next/link";
import { use } from "react";
import { AddUnitButton } from "@/components/features/units/add-unit-button";
import {
	PropertyForm,
	type PropertyFormValues,
} from "@/components/forms/property-form";
import { UnitForm } from "@/components/forms/unit-form";
import { Container } from "@/components/shared/container";
import { useOptimisticUpdateProperty, useProperty } from "@/hooks/properties";
import { useOptimisticCreateUnit, usePropertyUnits } from "@/hooks/units";

export default function PropertyDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);

	const addUnit = useFormDialog();
	const createUnit = useOptimisticCreateUnit();
	const editProperty = useFormDialog();
	const updateProperty = useOptimisticUpdateProperty();

	const { data: propertyData, isLoading: propertyLoading } = useProperty(id);
	const { data: unitsData, isLoading: unitsLoading } = usePropertyUnits(id);

	function handleCreateUnit(values: CreateUnit) {
		createUnit.mutate(values, {
			onSuccess: () => addUnit.closeDialog(),
		});
	}
	function handlerUpdateProperty(values: PropertyFormValues) {
		updateProperty.mutate(
			{ id, data: values },
			{ onSuccess: () => editProperty.closeDialog() },
		);
	}

	if (propertyLoading) {
		return (
			<div className="col-span-12 space-y-4">
				<div className="h-8 w-48 animate-pulse rounded bg-muted" />
				<div className="h-40 animate-pulse rounded-xl bg-muted" />
			</div>
		);
	}

	if (!propertyData?.property) {
		return (
			<div className="col-span-12 py-20 text-center text-muted-foreground">
				Property not found.
			</div>
		);
	}

	const { property } = propertyData;
	const units = unitsData?.units ?? [];
	const occupiedUnits = units.filter((u) => u.status === "occupied");
	const monthlyRevenue = occupiedUnits.reduce((sum, u) => sum + u.baseRent, 0);
	const vacantUnits = units.length - occupiedUnits.length;
	const occupancyRate =
		units.length > 0
			? Math.round((occupiedUnits.length / units.length) * 100)
			: 0;

	return (
		<Container>
			<div className="col-span-12 space-y-6">
				{/*Breadcrumb  + actions*/}
				<div className="flex items-center justify-between gap-4">
					<Button
						variant="ghost"
						nativeButton={false}
						className="-ml-2 text-muted-foreground"
						render={<Link href="/properties" />}
					>
						<IconChevronLeft className="size-4" />
						Properties
					</Button>
					<div className="flex gap-2">
						<Button
							onClick={editProperty.openDialog}
							variant={"secondary"}
							className="h-10 bg-white hover:bg-blue-100"
						>
							<IconPencil className="size-4" />
							Edit
						</Button>
						<FormDialog
							open={editProperty.open}
							onOpenChange={editProperty.onOpenChange}
							title={`Edit Property : ${property.name}`}
							description="Update the property details."
							formId="update-property-form"
							isSubmitting={updateProperty.isPending}
							submitLabel="Update Property"
						>
							<PropertyForm
								key={editProperty.open ? "open" : "closed"}
								defaultValues={{
									name: property.name,
									address: property.address,
									type: property.type,
									description: property.description,
									floors: property.floors,
									totalArea: property.totalArea,
									yearBuilt: property.yearBuilt,
								}}
								formId="update-property-form"
								onSubmit={handlerUpdateProperty}
								isSubmitting={updateProperty.isPending}
							/>
						</FormDialog>
						<Button onClick={addUnit.openDialog} className="h-10">
							<IconPlus className="mr-2 size-4" /> Add Unit
						</Button>
						<FormDialog
							open={addUnit.open}
							onOpenChange={addUnit.onOpenChange}
							title="Add Unit"
							description="Fill in the details for the new unit."
							formId="create-unit-form"
							isSubmitting={createUnit.isPending}
							submitLabel="Create Unit"
						>
							<UnitForm
								propertyId={property.id}
								formId="create-unit-form"
								onSubmit={handleCreateUnit}
								isSubmitting={createUnit.isPending}
							/>
						</FormDialog>
					</div>
				</div>

				<section className="overflow-hidden rounded-xl border bg-card shadow-sm">
					<div className="relative overflow-hidden border-b bg-gradient-to-br from-primary/[0.09] via-card to-card px-5 py-6 sm:px-7">
						<div className="absolute -top-16 -right-10 size-48 rounded-full bg-primary/[0.07] blur-2xl" />
						<div className="relative flex flex-col gap-6">
							<div className="flex flex-wrap items-start justify-between gap-4">
								<div className="space-y-2">
									<div className="flex items-center gap-2">
										<div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
											<IconHome2 className="size-4" />
										</div>
										<Badge
											variant="outline"
											className="rounded-full border-primary/20 bg-primary/5 px-2.5 text-primary capitalize"
										>
											{property.type}
										</Badge>
									</div>
									<div>
										<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.14em]">
											Property overview
										</p>
										<h2 className="mt-1 font-semibold text-2xl tracking-tight sm:text-3xl">
											{property.name}
										</h2>
										<p className="mt-1 text-muted-foreground text-sm">
											{property.address}
										</p>
									</div>
								</div>
								<div className="min-w-44 rounded-lg border border-primary/15 bg-background/70 px-4 py-3 backdrop-blur-sm">
									<div className="flex items-baseline justify-between gap-3">
										<p className="font-semibold text-2xl">{occupancyRate}%</p>
										<p className="text-muted-foreground text-xs">occupied</p>
									</div>
									<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/10">
										<div
											className="h-full rounded-full bg-primary transition-all"
											style={{ width: `${occupancyRate}%` }}
										/>
									</div>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
								<PropertyMetric label="Total units" value={units.length} />
								<PropertyMetric
									label="Occupied"
									value={occupiedUnits.length}
									className="text-emerald-600"
								/>
								<PropertyMetric
									label="Available"
									value={vacantUnits}
									className="text-amber-600"
								/>
								<PropertyMetric
									label="Monthly revenue"
									value={`₹${monthlyRevenue.toLocaleString("en-IN")}`}
								/>
							</div>
						</div>
					</div>

					{(property.description ||
						property.floors ||
						property.totalArea ||
						property.yearBuilt) && (
						<div className="grid gap-5 border-b px-5 py-5 sm:px-7 lg:grid-cols-[1fr_auto]">
							<div>
								<p className="font-medium text-sm">About this property</p>
								{property.description && (
									<p className="mt-1.5 max-w-3xl text-muted-foreground text-sm leading-6">
										{property.description}
									</p>
								)}
							</div>
							<div className="flex flex-wrap gap-x-5 gap-y-3 text-muted-foreground text-sm lg:justify-end">
								{property.floors && (
									<PropertyFact
										icon={IconBuilding}
										value={`${property.floors} floors`}
									/>
								)}
								{property.totalArea && (
									<PropertyFact
										icon={IconRuler2}
										value={`${property.totalArea} sq ft`}
									/>
								)}
								{property.yearBuilt && (
									<PropertyFact
										icon={IconCalendar}
										value={`Built ${property.yearBuilt}`}
									/>
								)}
							</div>
						</div>
					)}

					<div className="px-5 py-5 sm:px-7">
						<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
							<div>
								<h2 className="font-semibold text-lg">Units</h2>
								<p className="text-muted-foreground text-sm">
									{units.length === 1
										? "1 unit in this property"
										: `${units.length} units in this property`}
								</p>
							</div>
							<div className="hidden items-center gap-1.5 text-muted-foreground text-xs sm:flex">
								<IconUsers className="size-3.5" />
								{occupiedUnits.length} tenants currently assigned
							</div>
						</div>
						{unitsLoading ? (
							<UnitSkelton />
						) : units.length === 0 ? (
							<NoUnit id={id} />
						) : (
							<div className="overflow-hidden rounded-lg border">
								{units.map((unit) => (
									<DetailUnitsList key={unit.id} unit={unit} />
								))}
							</div>
						)}
					</div>
				</section>
			</div>
		</Container>
	);
}

// ************ components

function UnitSkelton() {
	return (
		<div className="overflow-hidden rounded-lg border">
			{Array.from({ length: 3 }).map((_, i) => (
				<div
					key={i}
					className="h-20 animate-pulse border-b bg-muted/60 last:border-b-0"
				/>
			))}
		</div>
	);
}

function NoUnit({ id }: { id: string }) {
	return (
		<EmptyState
			icon={IconLayout}
			title="No units yet"
			description="Add your first unit to start tracking tenants and rent."
			className="rounded-lg border border-dashed bg-muted/30 shadow-none"
		>
			<AddUnitButton propertyId={id} withIcon />
		</EmptyState>
	);
}

function DetailUnitsList({ unit }: { unit: UnitWithLease }) {
	const isOccupied = unit.status === "occupied";
	const tenantName = unit.activeLease?.tenantName;

	return (
		<Link
			key={unit.id}
			href={`/units/${unit.id}`}
			className="group flex items-center gap-3 border-b bg-card px-3 py-3 transition-colors last:border-b-0 hover:bg-muted/50 sm:gap-4 sm:px-4"
		>
			<IconWrapper className="size-10 shrink-0 rounded-lg bg-primary/8 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
				<IconLayout />
			</IconWrapper>
			<div className="min-w-0 flex-1">
				<p className="font-medium text-sm sm:text-base">
					Unit {unit.unitNumber}
				</p>
				<p className="mt-0.5 truncate text-muted-foreground text-xs capitalize sm:text-sm">
					{unit.type}
					{unit.area ? ` · ${unit.area.toLocaleString("en-IN")} sq ft` : ""}
				</p>
			</div>
			<div className="hidden min-w-36 flex-1 text-muted-foreground text-sm md:block">
				{tenantName ?? "Available"}
			</div>
			<div className="text-right">
				<p className="font-medium text-sm sm:text-base">
					₹{unit.baseRent.toLocaleString("en-IN")}/mo
				</p>
				<p className="mt-0.5 truncate text-muted-foreground text-xs md:hidden">
					{tenantName ?? "Available"}
				</p>
			</div>
			<Badge
				variant="outline"
				className={
					isOccupied
						? "rounded-full border-emerald-200 bg-emerald-50 text-emerald-700"
						: "rounded-full border-amber-200 bg-amber-50 text-amber-700"
				}
			>
				{isOccupied ? "Occupied" : "Available"}
			</Badge>
		</Link>
	);
}

function PropertyMetric({
	label,
	value,
	className,
}: {
	label: string;
	value: string | number;
	className?: string;
}) {
	return (
		<div>
			<p className="text-muted-foreground text-xs">{label}</p>
			<p
				className={`mt-1 font-semibold text-xl tracking-tight ${className ?? ""}`}
			>
				{value}
			</p>
		</div>
	);
}

function PropertyFact({
	icon: Icon,
	value,
}: {
	icon: typeof IconBuilding;
	value: string;
}) {
	return (
		<span className="flex items-center gap-1.5 whitespace-nowrap">
			<Icon className="size-3.5" />
			{value}
		</span>
	);
}
