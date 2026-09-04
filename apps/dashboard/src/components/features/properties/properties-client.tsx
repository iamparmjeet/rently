"use client";

import { formatRupees } from "@rently/ui/lib/currency";
import { PageHeader } from "@rently/ui/shared/page-header";
import {
	IconBuilding,
	IconChartBar,
	IconLayoutBoard,
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

	const occupancyRate =
		pageStats.totalUnits > 0
			? Math.round((pageStats.occupiedUnits / pageStats.totalUnits) * 100)
			: 0;

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

				<section className="overflow-hidden rounded-xl border bg-card shadow-sm">
					<div className="grid divide-y sm:grid-cols-[1.05fr_1fr] sm:divide-x sm:divide-y-0">
						<div className="relative overflow-hidden bg-linear-to-br from-primary/8 via-card to-card p-5">
							<div className="absolute -top-10 -right-10 size-32 rounded-full bg-primary/8 blur-2xl" />
							<div className="relative">
								<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.14em]">
									Portfolio health
								</p>
								{isLoading ? (
									<div className="mt-2 h-9 w-24 animate-pulse rounded bg-muted" />
								) : (
									<p className="mt-1 font-semibold text-3xl tracking-tight">
										{occupancyRate}%{" "}
										<span className="font-normal text-base text-muted-foreground">
											occupied
										</span>
									</p>
								)}
								<div className="mt-4 h-1.5 max-w-sm overflow-hidden rounded-full bg-primary/10">
									<div
										className="h-full rounded-full bg-primary transition-all"
										style={{ width: `${occupancyRate}%` }}
									/>
								</div>
								<p className="mt-2 text-muted-foreground text-xs">
									{pageStats.occupiedUnits} of {pageStats.totalUnits} units are
									currently occupied
								</p>
							</div>
						</div>
						<div className="grid grid-cols-3 divide-x">
							<PortfolioMetric
								icon={IconBuilding}
								label="Properties"
								value={pageStats.totalProperties}
								isLoading={isLoading}
							/>
							<PortfolioMetric
								icon={IconLayoutBoard}
								label="Units"
								value={pageStats.totalUnits}
								isLoading={isLoading}
							/>
							<PortfolioMetric
								icon={IconChartBar}
								label="Monthly revenue"
								value={`${formatRupees(pageStats.monthlyRevenue)}`}
								isLoading={isLoading}
							/>
						</div>
					</div>
				</section>

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

function PortfolioMetric({
	icon: Icon,
	label,
	value,
	isLoading,
}: {
	icon: typeof IconBuilding;
	label: string;
	value: string | number;
	isLoading: boolean;
}) {
	return (
		<div className="min-w-0 px-3 py-5 text-center sm:px-4">
			<Icon className="mx-auto size-4 text-primary" />
			<p className="mt-2 truncate text-muted-foreground text-xs">{label}</p>
			{isLoading ? (
				<div className="mx-auto mt-1 h-5 w-12 animate-pulse rounded bg-muted" />
			) : (
				<p className="mt-1 truncate font-semibold text-sm sm:text-base">
					{value}
				</p>
			)}
		</div>
	);
}
