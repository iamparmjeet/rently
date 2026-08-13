"use client";

import { PageHeader } from "@rently/ui/shared/page-header";
import { type StatItem, StatsGrid } from "@rently/ui/shared/stat-grid";
import {
	IconBuilding,
	IconChartBar,
	IconLayoutBoard,
	IconUsers,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import {
	PropertyFiltersBar,
	PropertyGrid,
} from "@/components/features/properties";
import { Container } from "@/components/shared/container";
import { useSuspenseProperties } from "@/hooks/properties";
import type { PropertyFilters } from "@/types/property";
import { PropertyActionButton } from "./property-action-button";

export function PropertiesClient() {
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
	const { data, isLoading } = useSuspenseProperties();

	// Client-side filtering/sorting (happens on cached data, no network)
	const filteredProperties = useMemo(() => {
		const list = data?.properties ?? [];

		return [...list]
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
				if (filters.sortBy === "units")
					return dir * (a.totalUnits - b.totalUnits);
				return 0;
			});
	}, [data?.properties, filters]);

	// Page Stats
	const pageStats = useMemo(() => {
		const list = data?.properties ?? [];
		return {
			totalProperties: list.length,
			totalUnits: list.reduce((sum, p) => sum + p.totalUnits, 0),
			occupiedUnits: list.reduce((sum, p) => sum + p.occupiedUnits, 0),
			monthlyRevenue: list.reduce((sum, p) => sum + p.monthlyRevenue, 0),
		};
	}, [data?.properties]);

	const stats = useMemo<StatItem[]>(() => {
		const occupancyRate =
			pageStats.totalUnits > 0
				? Math.round((pageStats.occupiedUnits / pageStats.totalUnits) * 100)
				: 0;

		return [
			{
				icon: IconBuilding,
				label: "Properties",
				value: pageStats.totalProperties,
			},
			{
				icon: IconLayoutBoard,
				label: "Total Units",
				value: pageStats.totalUnits,
			},
			{
				icon: IconUsers,
				label: "Occupancy",

				value: `${occupancyRate}%`,
			},
			{
				icon: IconChartBar,
				label: "Monthly Revenue",
				value: `₹${pageStats.monthlyRevenue.toLocaleString("en-IN")}`,
			},
		];
	}, [pageStats]);

	return (
		<Container>
			<div className="col-span-12 flex flex-col gap-6">
				{/* Page Header */}
				<PageHeader
					title="Properties"
					description="Manage your properties and track occupancy"
				>
					<PropertyActionButton withIcon={true} />
				</PageHeader>

				{/* Stats bar — loading skeleton built into component */}
				<StatsGrid stats={stats} isLoading={isLoading} />

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
				/>
			</div>
		</Container>
	);
}
