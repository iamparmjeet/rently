"use client";

// Uses useSuspenseProperties() — data is ALWAYS defined here.
// The Suspense boundary in page.tsx handles the loading state.
//
import { Button } from "@rently/ui/components/button";
import { PageHeader } from "@rently/ui/shared/page-header";
import { IconPlus } from "@tabler/icons-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PropertyFiltersBar } from "@/components/features/properties/property-filters";
import { PropertyGrid } from "@/components/features/properties/property-grid";
import { PropertyStats } from "@/components/features/properties/property-stats";
import { useDeleteProperty, useSuspenseProperties } from "@/hooks/properties";
import type { PropertyFilters } from "@/types/property";

export default function PropertiesClient() {
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
	const { data } = useSuspenseProperties();
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
				isLoading={false}
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
				onDelete={(id) => deleteProperty.mutate({ id })}
				isDeletingId={
					deleteProperty.isPending ? deleteProperty.variables?.id : undefined
				}
			/>
		</div>
	);
}
