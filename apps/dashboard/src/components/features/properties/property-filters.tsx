// src/components/properties/property-filters.tsx
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
import { IconLayoutGrid, IconTable } from "@tabler/icons-react";
import type { PropertyFilters } from "@/types/property";

interface PropertyFiltersProps {
	filters: PropertyFilters;
	onFiltersChange: (filters: PropertyFilters) => void;
	viewMode: "grid" | "table";
	onViewModeChange: (mode: "grid" | "table") => void;
}

export function PropertyFiltersBar({
	filters,
	onFiltersChange,
	viewMode,
	onViewModeChange,
}: PropertyFiltersProps) {
	return (
		<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
			{/* Search */}
			<Input
				placeholder="Search by name or address..."
				value={filters.search}
				onChange={(e) =>
					onFiltersChange({ ...filters, search: e.target.value })
				}
				className="sm:max-w-xs"
			/>

			{/* Type filter */}
			<Select
				value={filters.type}
				onValueChange={(value) =>
					onFiltersChange({
						...filters,
						type: value as PropertyFilters["type"],
					})
				}
			>
				<SelectTrigger className="w-35">
					<SelectValue placeholder="All Types" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All Types</SelectItem>
					<SelectItem value="residential">Residential</SelectItem>
					<SelectItem value="commercial">Commercial</SelectItem>
				</SelectContent>
			</Select>

			{/* Sort */}
			<Select
				value={`${filters.sortBy}-${filters.sortOrder}`}
				onValueChange={(value) => {
					const [sortBy, sortOrder] = value?.split("-") as [
						PropertyFilters["sortBy"],
						PropertyFilters["sortOrder"],
					];
					onFiltersChange({ ...filters, sortBy, sortOrder });
				}}
			>
				<SelectTrigger className="w-40">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="created_at-desc">Newest First</SelectItem>
					<SelectItem value="created_at-asc">Oldest First</SelectItem>
					<SelectItem value="name-asc">Name A–Z</SelectItem>
					<SelectItem value="name-desc">Name Z–A</SelectItem>
					<SelectItem value="units-desc">Most Units</SelectItem>
				</SelectContent>
			</Select>

			{/* View mode toggle */}
			<div className="ml-auto flex items-center gap-1 rounded-md border p-1">
				<Button
					variant={viewMode === "grid" ? "secondary" : "ghost"}
					size="icon"
					className="h-7 w-7"
					onClick={() => onViewModeChange("grid")}
				>
					<IconLayoutGrid className="h-3.5 w-3.5" />
				</Button>
				<Button
					variant={viewMode === "table" ? "secondary" : "ghost"}
					size="icon"
					className="h-7 w-7"
					onClick={() => onViewModeChange("table")}
				>
					<IconTable className="h-3.5 w-3.5" />
				</Button>
			</div>
		</div>
	);
}
