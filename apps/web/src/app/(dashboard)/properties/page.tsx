"use client";

import { Button } from "@rently/ui/components/button";
import { IconPlus } from "@tabler/icons-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PropertyFiltersBar } from "@/components/features/properties/property-filters";
import { PropertyGrid } from "@/components/features/properties/property-grid";
import { PropertyStats } from "@/components/features/properties/property-stats";
import { PageHeader } from "@/components/shared/page-header";
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
	// console.log("properties", data);

	// Client-side filtering/sorting (happens on cached data, no network)
	const filteredProperties = useMemo(() => {
		const list = data?.properties ?? [];

		return list
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
	if (isError) return <IsError error={error} />;

	return (
		<div className="col-span-12 flex flex-col gap-6">
			{/* Page Header */}
			<PageHeader
				title="Properties"
				description="Manage your properties and units"
			>
				<Button>
					<Link href="/properties/new" className="flex items-center gap-2">
						<IconPlus className="size-4" /> New Property
					</Link>
				</Button>
			</PageHeader>

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
			<PropertyGrid
				allProperties={data?.properties ?? []}
				properties={filteredProperties}
				isLoading={isLoading}
				isError={isError}
				error={error}
				onDelete={(id) => deleteProperty.mutate({ id })}
				isDeletingId={
					deleteProperty.isPending ? deleteProperty.variables?.id : undefined
				}
			/>
		</div>
	);
}

function IsError({ error }: { error: Error }) {
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
