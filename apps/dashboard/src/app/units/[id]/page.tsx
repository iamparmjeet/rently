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
	IconAlertCircle,
	IconBuildingStore,
	IconHome,
	IconPencil,
	IconPlus,
	IconRuler,
	IconTrash,
	IconUser,
} from "@tabler/icons-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import { DetailHeader } from "@/components/shared/detail-header";
import { NotFoundState } from "@/components/shared/not-found-state";
import { PageLoader } from "@/components/shared/page-loader";
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

	if (isLoading) return <PageLoader rows={2} />;
	if (!data?.unit) return <NotFoundState message="Unit not found." />;

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
			<DetailHeader
				backHref={`/properties/${unit.propertyId}` as Route}
				title={`Unit ${unit.unitNumber}`}
				subtitle={unit.propertyName ?? undefined}
			>
				<div className="flex items-center gap-2">
					<Button variant="outline">
						<Link href={`/units/${id}/edit`} className="flex items-center">
							<IconPencil className="mr-2 size-4" />
							Edit
						</Link>
					</Button>
					<Button
						title={isOccupied ? "Cannot Delete an Occupied Unit" : undefined}
						variant="destructive"
						onClick={handleDelete}
						disabled={deleteUnit.isPending || isOccupied}
					>
						<IconTrash className="mr-2 size-4" />
						{isOccupied ? "Occupied" : "Delete"}
					</Button>
				</div>
			</DetailHeader>

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
			{/*// apps/web/src/app/(dashboard)/units/[id]/page.tsx // Replace the entire
			"Lease section" Card with this:*/}
			{/* Lease section — now fully functional */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<CardTitle className="text-base">Active Lease</CardTitle>
					{data.unit.activeLease && (
						<Badge variant="default" className="capitalize">
							{data.unit.activeLease.status}
						</Badge>
					)}
				</CardHeader>
				<CardContent>
					{data.unit.activeLease ? (
						// ← HAS ACTIVE LEASE: Show lease summary with link
						<div className="space-y-4">
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
									<IconUser className="size-5 text-primary" />
								</div>
								<div>
									<p className="font-semibold">
										{data.unit.activeLease.tenantName}
									</p>
									<p className="text-muted-foreground text-sm">
										{data.unit.activeLease.tenantEmail}
									</p>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4 text-sm">
								<div>
									<p className="text-muted-foreground">Monthly Rent</p>
									<p className="font-semibold">
										₹{data.unit.activeLease.rent.toLocaleString("en-IN")}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground">Lease Started</p>
									<p className="font-semibold">
										{new Date(
											data.unit.activeLease.startDate,
										).toLocaleDateString("en-IN")}
									</p>
								</div>
							</div>

							<div className="flex gap-2">
								<Button variant="outline" size="sm" className="flex-1">
									<Link href={`/leases/${data.unit.activeLease.id}`}>
										View Full Lease
									</Link>
								</Button>
								<Button variant="outline" size="sm" className="flex-1">
									<Link href={`/leases/${data.unit.activeLease.id}/edit`}>
										Edit Lease
									</Link>
								</Button>
							</div>
						</div>
					) : isOccupied ? (
						// ← DATA INCONSISTENCY: Unit says occupied but no lease found
						<div className="rounded-lg border border-amber-200 bg-amber-50 py-6 text-center dark:border-amber-900 dark:bg-amber-950">
							<IconAlertCircle className="mx-auto mb-2 size-6 text-amber-600" />
							<p className="font-medium text-amber-800 text-sm dark:text-amber-200">
								Data Inconsistency Detected
							</p>
							<p className="text-amber-700 text-xs dark:text-amber-300">
								Unit status is "occupied" but no active lease found.
							</p>
							<Button
								nativeButton={false}
								variant="outline"
								size="sm"
								className="mt-3"
								render={<Link href="/leases/new" />}
								aria-label="Create Lease"
							>
								Create Lease
							</Button>
						</div>
					) : (
						// ← NO LEASE: Unit is available, prompt to create
						<div className="rounded-lg border border-dashed py-8 text-center">
							<IconHome className="mx-auto mb-3 size-10 text-muted-foreground/50" />
							<p className="mb-1 font-medium">No Active Lease</p>
							<p className="mb-4 text-muted-foreground text-sm">
								This unit is available for rent.
							</p>
							<Button
								aria-label="Create lease"
								nativeButton={false}
								render={
									<Link
										href={{
											pathname: "/leases/new",
											query: { preselectedUnit: unit.id }, // Pre-fill the unit
										}}
									/>
								}
							>
								<IconPlus className="mr-2 size-4" />
								Create Lease
							</Button>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
