"use client";

import { NotFoundState } from "@rently/ui/shared/not-found-state";
import { PageHeader } from "@rently/ui/shared/page-header";
import { type StatItem, StatsGrid } from "@rently/ui/shared/stat-grid";
import {
	IconChartBar,
	IconCircleHalf2,
	IconLayoutBoard,
	IconUsers,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import {
	AddUnitButton,
	type UnitFilters,
	UnitFiltersBar,
	UnitGrid,
} from "@/components/features/units";
import { Container } from "@/components/shared/container";
import { useDeleteUnit, useUnits } from "@/hooks/units";

export default function UnitsPage() {
	const [filters, setFilters] = useState<UnitFilters>({
		search: "",
		status: "all",
		type: "all",
	});

	const { data, isLoading, isError } = useUnits();
	const deleteUnit = useDeleteUnit();

	const filteredUnits = useMemo(() => {
		if (!data?.units) return [];
		return data.units.filter((unit) => {
			if (filters.search) {
				const q = filters.search.toLowerCase();
				if (
					!unit.unitNumber.toLowerCase().includes(q) &&
					!unit.propertyName.toLowerCase().includes(q)
				)
					return false;
			}
			if (filters.status !== "all" && unit.status !== filters.status)
				return false;
			if (filters.type !== "all" && unit.type !== filters.type) return false;
			return true;
		});
	}, [data?.units, filters]);

	const pageStats = useMemo(() => {
		const list = data?.units ?? [];
		const totalUnits = list.length;
		const occupiedUnits = list.filter((u) => u.status === "occupied").length;
		const occupancyRate =
			totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
		return {
			totalUnits,
			vacantUnits: totalUnits - occupiedUnits,
			occupancyRate,
			monthlyRevenue: list.reduce((sum, u) => sum + u.baseRent, 0),
		};
	}, [data?.units]);

	const stats = useMemo<StatItem[]>(
		() => [
			{
				icon: IconLayoutBoard,
				label: "Total Units",
				value: pageStats.totalUnits,
			},
			{
				icon: IconUsers,
				label: "Occupancy",
				value: `${pageStats.occupancyRate}%`,
			},
			{
				icon: IconCircleHalf2,
				label: "Vacant Units",
				value: pageStats.vacantUnits,
			},
			{
				icon: IconChartBar,
				label: "Monthly Revenue",
				value: `₹${pageStats.monthlyRevenue.toLocaleString("en-IN")}`,
			},
		],
		[pageStats],
	);

	// GOTCHA: guard comes after all hooks
	if (isError) return <NotFoundState />;

	return (
		<Container>
			<div className="col-span-12 flex flex-col gap-6">
				<PageHeader
					title="Units"
					description="Manage units across all properties"
				>
					<AddUnitButton withIcon />
				</PageHeader>

				<StatsGrid stats={stats} isLoading={isLoading} />

				<UnitFiltersBar filters={filters} onFiltersChange={setFilters} />

				<UnitGrid
					allUnits={data?.units ?? []}
					units={filteredUnits}
					isLoading={isLoading}
					isDeletingId={
						deleteUnit.isPending ? deleteUnit.variables?.id : undefined
					}
				/>
			</div>
		</Container>
	);
}
