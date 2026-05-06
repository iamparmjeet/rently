"use client";

import {
	IconArrowLeft,
	IconBuilding,
	IconPencil,
	IconPlus,
} from "@tabler/icons-react";
import Link from "next/link";
import { use } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProperty, usePropertyUnits } from "@/hooks/properties";

export default function PropertyDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);

	const { data: propertyData, isLoading: propertyLoading } = useProperty(id);
	const { data: unitsData, isLoading: unitsLoading } = usePropertyUnits(id);

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
			<div className="col-span-12 text-center py-20 text-muted-foreground">
				Property not found.
			</div>
		);
	}

	const { property } = propertyData;
	const units = unitsData?.units ?? [];
	const occupiedUnits = units.filter((u) => u.status === "occupied");
	const monthlyRevenue = occupiedUnits.reduce((sum, u) => sum + u.baseRent, 0);

	return (
		<div className="col-span-12 space-y-6">
			{/*Breadcrumb  + actions*/}
			<div className="flex items-center justify-between">
				<Button variant="ghost" size={"icon"}>
					<Link href="/properties">
						<IconArrowLeft className="size-4" />
					</Link>
				</Button>
				<div>
					<h1 className="text-xl font-semibold">{property.name}</h1>
					<p className="text-sm text-muted-foreground">{property.address}</p>
				</div>
			</div>
			<div className="flex gap-2">
				<Button variant={"outline"}>
					<Link
						href={`/properties/${id}/edit`}
						className="flex items-center gap-2"
					>
						<IconPencil className="size-4" />
						Edit
					</Link>
				</Button>
				<Button>
					<Link
						href={`/units/new?propertyId=${id}`}
						className="flex items-center gap-2"
					>
						<IconPlus className="size-4" />
						Add Unit
					</Link>
				</Button>
			</div>

			{/* Property Info Card*/}
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<IconBuilding className="text-muted-foreground size-5" />
						<CardTitle className="text-base">Details</CardTitle>
						<Badge variant="outline" className="ml-auto capitalize">
							{property.type}
						</Badge>
					</div>
				</CardHeader>
				<CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
					<div>
						<p className="text-xs text-muted-foreground">Total Units</p>
						<p className="text-2xl font-semibold">{units.length}</p>
					</div>
					<div>
						<p className="text-xs text-muted-foreground">Occupied</p>
						<p className="text-2xl font-semibold text-green-600">
							{occupiedUnits.length}
						</p>
					</div>
					<div>
						<p className="text-xs text-muted-foreground">Vacant</p>
						<p className="text-2xl font-semibold text-orange-500">
							{units.length - occupiedUnits.length}
						</p>
					</div>
					<div>
						<p className="text-xs text-muted-foreground">Monthly Revenue</p>
						<p className="text-2xl font-semibold">
							₹{monthlyRevenue.toLocaleString("en-IN")}
						</p>
					</div>
				</CardContent>
			</Card>

			{/* Units List */}
			<div>
				<h2 className="text-base font-semibold mb-3">Units</h2>
				{unitsLoading ? (
					<div className="space-y-2">
						{Array.from({ length: 3 }).map((_, i) => (
							<div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
						))}
					</div>
				) : units.length === 0 ? (
					<div className="rounded-xl border border-dashed py-12 text-center">
						<p>
							No Units yet.
							<Button>
								<Link href={`/units/new?propertyId=${id}`}>
									Add the first unit.
								</Link>
							</Button>
						</p>
					</div>
				) : (
					<div className="space-y-2">
						{units.map((unit) => (
							<Link
								key={unit.id}
								href={`/units/${unit.id}`}
								className="flex items-center gap-4 rounded-lg border bg-card p-4 transition hover:bg-accent/50"
							>
								<div className="flex-1">
									<p className="font-medium">Unit {unit.unitNumber}</p>
									<p className="text-xs text-muted-foreground capitalize">
										{unit.type} . {unit.area ? `${unit.area} sq ft` : "N/A"}
									</p>
								</div>
								<div className="text-right">
									<p className="text-sm font-medium">
										₹{unit.baseRent.toLocaleString("en-IN")}
									</p>
									<Badge
										variant={
											unit.status === "occupied" ? "default" : "secondary"
										}
										className="mt-0.5 text-xs"
									>
										{unit.status}
									</Badge>
								</div>
							</Link>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
