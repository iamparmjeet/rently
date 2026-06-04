"use client";

import { Badge } from "@rently/ui/components/badge";
import { Button } from "@rently/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import { DetailHeader } from "@rently/ui/shared/detail-header";
import { EmptyState } from "@rently/ui/shared/empty-state";
import { FormDialog, useFormDialog } from "@rently/ui/shared/form-dialog";
import { IconWrapper } from "@rently/ui/shared/icon-wrapper";
import type { CreateUnit, UnitWithLease } from "@rently/validators";
import {
	IconHome2,
	IconLayout,
	IconPencil,
	IconPlus,
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

	return (
		<Container>
			<div className="col-span-12 space-y-6">
				{/*Breadcrumb  + actions*/}
				<DetailHeader
					backHref={"/properties"}
					title={property.name}
					subtitle={property.address}
				>
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
				</DetailHeader>

				{/* Property Info Card*/}
				<Card className="p-4 shadow-xs">
					<CardHeader>
						<div className="flex items-center gap-2">
							<IconHome2 className="size-6 text-muted-foreground" />
							<CardTitle className="font-semibold text-lg">
								Property Details
							</CardTitle>
							<Badge
								variant="outline"
								className="ml-auto bg-blue-100 text-blue-600"
							>
								{property.type}
							</Badge>
						</div>
					</CardHeader>
					<CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
						<div>
							<p className="text-base text-muted-foreground">Total Units</p>
							<p className="font-semibold text-2xl">{units.length}</p>
						</div>
						<div>
							<p className="text-base text-muted-foreground">Occupied</p>
							<p className="font-semibold text-2xl text-green-700">
								{occupiedUnits.length}
							</p>
						</div>
						<div>
							<p className="text-base text-muted-foreground">Vacant</p>
							<p className="font-semibold text-2xl text-orange-700">
								{units.length - occupiedUnits.length}
							</p>
						</div>
						<div>
							<p className="text-base text-muted-foreground">Monthly Revenue</p>
							<p className="font-semibold text-2xl">
								₹{monthlyRevenue.toLocaleString("en-IN")}
							</p>
						</div>
					</CardContent>
				</Card>

				{/* Units List */}
				<div>
					<h2 className="mb-3 font-semibold text-lg">Units</h2>
					{unitsLoading ? (
						<UnitSkelton />
					) : units.length === 0 ? (
						<NoUnit id={id} />
					) : (
						<div className="space-y-2">
							{units.map((unit) => (
								<DetailUnitsList key={unit.id} unit={unit} />
							))}
						</div>
					)}
				</div>
			</div>
		</Container>
	);
}

// ************ components

function UnitSkelton() {
	return (
		<div className="space-y-2">
			{Array.from({ length: 3 }).map((_, i) => (
				<div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
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
			className="rounded-xl bg-white shadow"
		>
			<AddUnitButton propertyId={id} withIcon />
		</EmptyState>
	);
}

function DetailUnitsList({ unit }: { unit: UnitWithLease }) {
	return (
		<Link
			key={unit.id}
			href={`/units/${unit.id}`}
			className="flex items-center gap-4 rounded-lg border bg-card p-4 shadow-xs transition hover:bg-accent/50"
		>
			<IconWrapper className="text-blue-500">
				<IconLayout />
			</IconWrapper>
			<div className="flex-1">
				<p className="font-medium text-lg">Unit {unit.unitNumber}</p>
				<p className="text-base text-muted-foreground capitalize">
					{unit.type} . {unit.area ? `${unit.area} sq ft` : "N/A"}
				</p>
			</div>
			<div className="text-right">
				<p className="font-medium text-base">
					₹{unit.baseRent.toLocaleString("en-IN")}/mo
				</p>

				<p className="text-gray-500 text-xs">
					{unit.activeLease ? unit.activeLease.tenantName : "tenant"}
				</p>
			</div>
			<Badge
				variant={unit.status === "occupied" ? "outline" : "secondary"}
				className="mt-0.5 rounded text-xs"
			>
				{unit.status}
			</Badge>
		</Link>
	);
}
