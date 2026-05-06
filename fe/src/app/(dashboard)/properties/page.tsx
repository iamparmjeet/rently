"use client";

import { IconPlus } from "@tabler/icons-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PropertyCard } from "@/components/features/properties/property-card";
import { PropertyFiltersBar } from "@/components/features/properties/property-filters";
import { PropertyStats } from "@/components/features/properties/property-stats";
import { Button } from "@/components/ui/button";
import { useDeleteProperty, useProperties } from "@/hooks/properties";
import type { PropertyFilters } from "@/types/property";

export default function PropertiesPage() {
	const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
	const [filters, setFilters] = useState<PropertyFilters>({
		search: "",
		type: "all",
		sortBy: "created_at",
		sortOrder: "desc",
	});

	// --- Data fetching ---
	// useProperties() handles: fetching, caching, loading, error
	// No useEffect, no useState for data
	const { data, isLoading, isError, error } = useProperties();
	const deleteProperty = useDeleteProperty();

	// Client-side filtering/sorting (happens on cached data, no network)
	const filteredProperties = useMemo(() => {
		if (!data?.properties) return [];

		return data.properties
			.filter((property) => {
				if (filters.search) {
					const q = filters.search.toLowerCase();
					if (
						!property.name.toLowerCase().includes(q) &&
						!property.address.toLowerCase().includes(q)
					)
						return false;
				}
				if (filters.type !== "all" && property.type !== filters.type)
					return false;
				return true;
			})
			.sort((a, b) => {
				const dir = filters.sortOrder === "asc" ? 1 : -1;
				if (filters.sortBy === "name")
					return dir * a.name.localeCompare(b.name);
				if (filters.sortBy === "created_at")
					return (
						dir *
						(new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
					);
				return 0;
			});
	}, [data?.properties, filters]);

	// Error state
	if (isError) {
		return (
			<div className="col-span-12 flex flex-col items-center justify-center py-20 text-center">
				<p className="text-muted-foreground">
					{error.message || "Failed to load properties"}
				</p>
				<Button
					variant="outline"
					className="mt-4"
					onClick={() => location.reload()}
				>
					Try again
				</Button>
			</div>
		);
	}

	return (
		<div className="col-span-12 flex flex-col gap-6">
			{/* Page Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold">Properties</h1>
					<p className="text-sm text-muted-foreground mt-0.5">
						Manage your properties and track occupancy
					</p>
				</div>
				<Button size="lg">
					<Link href="/properties/new" className="flex items-center">
						<IconPlus className="mr-2 h-4 w-4" />
						Add Property
					</Link>
				</Button>
			</div>

			{/* Stats bar — loading skeleton built into component */}
			<PropertyStats
				totalProperties={data?.properties.length ?? 0}
				totalUnits={0}
				occupiedUnits={0}
				monthlyRevenue={0}
				isLoading={isLoading}
			/>

			{/* Filters */}
			<PropertyFiltersBar
				filters={filters}
				onFiltersChange={setFilters}
				viewMode={viewMode}
				onViewModeChange={setViewMode}
			/>

			{/* Property Grid */}
			{isLoading ? (
				// Skeleton loading state
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: skeleton
							key={i}
							className="h-48 animate-pulse rounded-xl bg-muted"
						/>
					))}
				</div>
			) : filteredProperties.length === 0 ? (
				<div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
					<p className="text-muted-foreground">
						{data?.properties.length === 0
							? "No properties yet. Add your first one!"
							: "No properties match your filters."}
					</p>
					{data?.properties.length === 0 && (
						<Button className="mt-4">
							<Link href="/properties/new">Add Property</Link>
						</Button>
					)}
				</div>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{filteredProperties.map((property) => (
						<PropertyCard
							key={property.id}
							property={property}
							onDelete={(id) => deleteProperty.mutate(id)}
							isDeleting={
								deleteProperty.isPending &&
								deleteProperty.variables === property.id
							}
						/>
					))}
				</div>
			)}
		</div>
	);
}
