"use client";

import { Input } from "@rently/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@rently/ui/components/select";

export type UnitFilters = {
	search: string;
	status: "all" | "available" | "occupied";
	type: "all" | "room" | "shop";
};

interface UnitFiltersBarProps {
	filters: UnitFilters;
	onFiltersChange: (filters: UnitFilters) => void;
}

export function UnitFiltersBar({
	filters,
	onFiltersChange,
}: UnitFiltersBarProps) {
	return (
		<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
			<Input
				placeholder="Search by unit number or property..."
				value={filters.search}
				onChange={(e) =>
					onFiltersChange({ ...filters, search: e.target.value })
				}
				className="sm:max-w-xs"
			/>

			<Select
				value={filters.status}
				onValueChange={(v) =>
					onFiltersChange({ ...filters, status: v as UnitFilters["status"] })
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
					onFiltersChange({ ...filters, type: v as UnitFilters["type"] })
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
	);
}
