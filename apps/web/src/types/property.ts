// Keep filter type as-is - it's a UI concept not from BE
export interface PropertyFilters {
	search: string;
	type: "residential" | "commercial" | "all";
	sortBy: "name" | "created_at" | "units";
	sortOrder: "asc" | "desc";
}
