"use client";

import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@rently/ui/components//card";
import { Badge } from "@rently/ui/components/badge";
import { Button } from "@rently/ui/components/button";
import { DetailHeader } from "@rently/ui/shared/detail-header";
import {
	IconBuilding,
	IconHome2,
	IconLayout,
	IconPencil,
	IconPlus,
} from "@tabler/icons-react";
import Link from "next/link";
import { use } from "react";
import { Container } from "@/components/shared/container";
import { IconWrapper } from "@/components/shared/icon-wrapper";
import { useProperty } from "@/hooks/properties";
import { usePropertyUnits } from "@/hooks/units";

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
							variant={"secondary"}
							className="h-10 bg-white hover:bg-blue-100"
						>
							<Link
								href={`/properties/${id}/edit`}
								className="flex items-center gap-2"
							>
								<IconPencil className="size-4" />
								Edit
							</Link>
						</Button>
						<Button className={"h-10"}>
							<Link
								href={`/units/new?propertyId=${id}`}
								className="flex items-center gap-2"
							>
								<IconPlus className="size-4" />
								Add Unit
							</Link>
						</Button>
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
							<p className="font-semibold text-3xl">{units.length}</p>
						</div>
						<div>
							<p className="text-base text-muted-foreground">Occupied</p>
							<p className="font-semibold text-3xl text-green-700">
								{occupiedUnits.length}
							</p>
						</div>
						<div>
							<p className="text-base text-muted-foreground">Vacant</p>
							<p className="font-semibold text-3xl text-orange-700">
								{units.length - occupiedUnits.length}
							</p>
						</div>
						<div>
							<p className="text-base text-muted-foreground">Monthly Revenue</p>
							<p className="font-semibold text-3xl">
								₹{monthlyRevenue.toLocaleString("en-IN")}
							</p>
						</div>
					</CardContent>
				</Card>

				{/* Units List */}
				<div>
					<h2 className="mb-3 font-semibold text-lg">Units</h2>
					{unitsLoading ? (
						<div className="space-y-2">
							{Array.from({ length: 3 }).map((_, i) => (
								<div
									key={i}
									className="h-16 animate-pulse rounded-lg bg-muted"
								/>
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
									className="flex items-center gap-4 rounded-lg border bg-card p-4 shadow-xs transition hover:bg-accent/50"
								>
									<IconWrapper className="text-blue-500">
										<IconLayout />
									</IconWrapper>
									<div className="flex-1">
										<p className="font-medium text-lg">
											Unit {unit.unitNumber}
										</p>
										<p className="text-base text-muted-foreground capitalize">
											{unit.type} . {unit.area ? `${unit.area} sq ft` : "N/A"}
										</p>
									</div>
									<div className="text-right">
										<p className="font-medium text-base">
											₹{unit.baseRent.toLocaleString("en-IN")}/mo
										</p>

										<p className="text-gray-500 text-xs">
											{unit.activeLease
												? unit.activeLease.tenantName
												: "tenant Name"}
										</p>
									</div>
									<Badge
										variant={
											unit.status === "occupied" ? "outline" : "secondary"
										}
										className="mt-0.5 rounded text-xs"
									>
										{unit.status}
									</Badge>
								</Link>
							))}
						</div>
					)}
				</div>
			</div>
		</Container>
	);
}
