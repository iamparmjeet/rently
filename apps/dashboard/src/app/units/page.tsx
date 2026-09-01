"use client";

import { formatRupees } from "@rently/ui/lib/currency";
import { NotFoundState } from "@rently/ui/shared/not-found-state";
import { PageHeader } from "@rently/ui/shared/page-header";
import {
	IconChartBar,
	IconCircleHalf2,
	IconLayoutBoard,
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

				<section className="overflow-hidden rounded-xl border bg-card shadow-sm">
					<div className="grid divide-y sm:grid-cols-[1.05fr_1fr] sm:divide-x sm:divide-y-0">
						<div className="relative overflow-hidden bg-linear-to-br from-primary/8 via-card to-card p-5">
							<div className="absolute -top-10 -right-10 size-32 rounded-full bg-primary/8 blur-2xl" />
							<div className="relative">
								<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.14em]">
									Occupancy health
								</p>
								{isLoading ? (
									<div className="mt-2 h-9 w-24 animate-pulse rounded bg-muted" />
								) : (
									<p className="mt-1 font-semibold text-3xl tracking-tight">
										{pageStats.occupancyRate}%{" "}
										<span className="font-normal text-base text-muted-foreground">
											occupied
										</span>
									</p>
								)}
								<div className="mt-4 h-1.5 max-w-sm overflow-hidden rounded-full bg-primary/10">
									<div
										className="h-full rounded-full bg-primary transition-all"
										style={{ width: `${pageStats.occupancyRate}%` }}
									/>
								</div>
								<p className="mt-2 text-muted-foreground text-xs">
									{pageStats.totalUnits - pageStats.vacantUnits} occupied ·{" "}
									{pageStats.vacantUnits} available
								</p>
							</div>
						</div>
						<div className="grid grid-cols-3 divide-x">
							<UnitMetric
								icon={IconLayoutBoard}
								label="Units"
								value={pageStats.totalUnits}
								isLoading={isLoading}
							/>
							<UnitMetric
								icon={IconCircleHalf2}
								label="Available"
								value={pageStats.vacantUnits}
								isLoading={isLoading}
							/>
							<UnitMetric
								icon={IconChartBar}
								label="Monthly rent"
								value={`${formatRupees(pageStats.monthlyRevenue)}`}
								isLoading={isLoading}
							/>
						</div>
					</div>
				</section>

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

function UnitMetric({
	icon: Icon,
	label,
	value,
	isLoading,
}: {
	icon: typeof IconLayoutBoard;
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
