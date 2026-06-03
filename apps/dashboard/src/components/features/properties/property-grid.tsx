import type { PropertyWithStats } from "@rently/validators";
import { PropertyActionButton } from "./property-action-button";
import { PropertyCardActions } from "./property-card-action";
import { PropertyCardSkeleton } from "./property-card-skelton";

interface PropertyGridProps {
	properties: PropertyWithStats[];
	allProperties: PropertyWithStats[];
	isLoading?: boolean;
}

export function PropertyGrid({
	properties,
	allProperties,
	isLoading,
}: PropertyGridProps) {
	if (isLoading) {
		return (
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: 6 }).map((_, i) => (
					<PropertyCardSkeleton key={i} animationDelay={i * 80} />
				))}
			</div>
		);
	}

	if (properties.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-white py-16 text-center shadow">
				<p className="mb-2 text-muted-foreground">
					{allProperties.length === 0
						? "No properties yet. Add your first one!"
						: "No properties match your filters."}
				</p>
				{allProperties.length === 0 && <PropertyActionButton />}
			</div>
		);
	}
	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{properties.map((property) => (
				<PropertyCardActions key={property.id} property={property} />
			))}
		</div>
	);
}
