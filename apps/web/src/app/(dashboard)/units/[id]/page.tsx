// apps/web/src/app/(dashboard)/units/[id]/page.tsx

"use client";

import { Badge } from "@rently/ui/components/badge";
import { Button } from "@rently/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import {
	IconArrowLeft,
	IconBuilding,
	IconBuildingStore,
	IconHome,
	IconPencil,
	IconRuler,
	IconTrash,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import { useDeleteUnit, useUnit } from "@/hooks/units";

export default function UnitDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const router = useRouter();

	const { data, isLoading } = useUnit(id);
	const deleteUnit = useDeleteUnit();

	if (isLoading) {
		return (
			<div className="col-span-12 space-y-4">
				<div className="h-8 w-48 animate-pulse rounded bg-muted" />
				<div className="h-40 animate-pulse rounded-xl bg-muted" />
			</div>
		);
	}

	if (!data?.unit) {
		return (
			<div className="col-span-12 py-20 text-center text-muted-foreground">
				Unit not found.
			</div>
		);
	}

	const { unit } = data;
	const isOccupied = unit.status === "occupied";

	function handleDelete() {
		deleteUnit.mutate(
			{ id: unit.id },
			{
				onSuccess: () => router.push(`/properties/${unit.propertyId}`),
			},
		);
	}

	return (
		<div className="col-span-12 space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<Button variant="ghost" size="icon">
						<Link href={`/properties/${unit.propertyId}`}>
							<IconArrowLeft className="size-4" />
						</Link>
					</Button>
					<div>
						<h1 className="font-semibold text-xl">Unit {unit.unitNumber}</h1>
						<Link
							href={`/properties/${unit.propertyId}`}
							className="flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
						>
							<IconBuilding className="size-3" />
							{unit.propertyName}
						</Link>
					</div>
				</div>

				<div className="flex gap-2">
					<Button variant="outline">
						<Link href={`/units/${id}/edit`} className="flex items-center">
							<IconPencil className="mr-2 size-4" />
							Edit
						</Link>
					</Button>
					<Button
						variant="destructive"
						onClick={handleDelete}
						disabled={deleteUnit.isPending || isOccupied}
					>
						<IconTrash className="mr-2 size-4" />
						{isOccupied ? "Cannot Delete (Occupied)" : "Delete"}
					</Button>
				</div>
			</div>

			{/* Unit Info Card */}
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						{unit.type === "room" ? (
							<IconHome className="size-5 text-muted-foreground" />
						) : (
							<IconBuildingStore className="size-5 text-muted-foreground" />
						)}
						<CardTitle className="text-base">Unit Information</CardTitle>
						<Badge
							variant={isOccupied ? "default" : "secondary"}
							className="ml-auto capitalize"
						>
							{unit.status}
						</Badge>
					</div>
				</CardHeader>
				<CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
					<div>
						<p className="text-muted-foreground text-xs">Type</p>
						<p className="font-semibold capitalize">{unit.type}</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Base Rent</p>
						<p className="font-semibold">
							₹{unit.baseRent.toLocaleString("en-IN")}/mo
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Area</p>
						<p className="font-semibold">
							{unit.area ? (
								<span className="flex items-center gap-1">
									<IconRuler className="size-3" />
									{unit.area} sq ft
								</span>
							) : (
								"—"
							)}
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Description</p>
						<p className="font-semibold text-sm">{unit.description ?? "—"}</p>
					</div>
				</CardContent>
			</Card>

			{/* Lease section — placeholder until lease feature is built */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Active Lease</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="rounded-lg border border-dashed py-8 text-center">
						<p className="text-muted-foreground text-sm">
							{isOccupied
								? "Lease details coming soon."
								: "No active lease. This unit is available."}
						</p>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
