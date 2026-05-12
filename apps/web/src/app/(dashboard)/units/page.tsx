// apps/web/src/app/(dashboard)/units/page.tsx

"use client";

import { Button } from "@rently/ui/components/button";
import { Input } from "@rently/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@rently/ui/components/select";
import { IconPlus } from "@tabler/icons-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { UnitCard } from "@/components/features/units/unit-card";
import { useDeleteUnit, useUnits } from "@/hooks/units";

type UnitFilters = {
	search: string;
	status: "all" | "available" | "occupied";
	type: "all" | "room" | "shop";
};

export default function UnitsPage() {
	const [filters, setFilters] = useState<UnitFilters>({
		search: "",
		status: "all",
		type: "all",
	});

	const { data, isLoading, isError, error } = useUnits();
	const deleteUnit = useDeleteUnit();

	// Client-side filtering on cached data — no network cost
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

	const totalUnits = data?.units.length ?? 0;
	const occupiedCount =
		data?.units.filter((u) => u.status === "occupied").length ?? 0;
	const availableCount = totalUnits - occupiedCount;

	if (isError) {
		return (
			<div className="col-span-12 flex flex-col items-center justify-center py-20 text-center">
				<p className="text-muted-foreground">{error.message}</p>
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
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-semibold text-2xl">Units</h1>
					<p className="mt-0.5 text-muted-foreground text-sm">
						All units across your properties
					</p>
				</div>
				<Button size="lg">
					<Link href="/units/new">
						<IconPlus className="mr-2 size-4" />
						Add Unit
					</Link>
				</Button>
			</div>

			{/* Quick Stats */}
			<div className="grid grid-cols-3 gap-3">
				{[
					{ label: "Total Units", value: totalUnits },
					{ label: "Occupied", value: occupiedCount },
					{ label: "Available", value: availableCount },
				].map((stat) => (
					<div
						key={stat.label}
						className="rounded-xl border bg-card p-4 text-center"
					>
						{isLoading ? (
							<div className="mx-auto h-7 w-12 animate-pulse rounded bg-muted" />
						) : (
							<p className="font-bold text-2xl">{stat.value}</p>
						)}
						<p className="text-muted-foreground text-xs">{stat.label}</p>
					</div>
				))}
			</div>

			{/* Filters */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
				<Input
					placeholder="Search by unit number or property..."
					value={filters.search}
					onChange={(e) =>
						setFilters((f) => ({ ...f, search: e.target.value }))
					}
					className="sm:max-w-xs"
				/>
				<Select
					value={filters.status}
					onValueChange={(v) =>
						setFilters((f) => ({ ...f, status: v as UnitFilters["status"] }))
					}
				>
					<SelectTrigger className="w-36">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Status</SelectItem>
						<SelectItem value="available">Available</SelectItem>
						<SelectItem value="occupied">Occupied</SelectItem>
					</SelectContent>
				</Select>
				<Select
					value={filters.type}
					onValueChange={(v) =>
						setFilters((f) => ({ ...f, type: v as UnitFilters["type"] }))
					}
				>
					<SelectTrigger className="w-32">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Types</SelectItem>
						<SelectItem value="room">Room</SelectItem>
						<SelectItem value="shop">Shop</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{/* Grid */}
			{isLoading ? (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: skeleton
							key={i}
							className="h-44 animate-pulse rounded-xl bg-muted"
						/>
					))}
				</div>
			) : filteredUnits.length === 0 ? (
				<div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
					<p className="text-muted-foreground">
						{totalUnits === 0
							? "No units yet. Add your first unit!"
							: "No units match your filters."}
					</p>
					{totalUnits === 0 && (
						<Button className="mt-4" asChild>
							<Link href="/units/new">Add Unit</Link>
						</Button>
					)}
				</div>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{filteredUnits.map((unit) => (
						<UnitCard
							key={unit.id}
							unit={unit}
							showPropertyName
							onDelete={(id) => deleteUnit.mutate({ id })}
							isDeleting={
								deleteUnit.isPending && deleteUnit.variables?.id === unit.id
							}
						/>
					))}
				</div>
			)}
		</div>
	);
}
