import { Button } from "@rently/ui/components/button";
import type { Property } from "@rently/validators";
import Link from "next/link";
import { PropertyCard } from "./property-card";

interface PropertyGridProps {
	properties: Property[];
	allProperties: Property[];
	onDelete: (id: string) => void;
	isDeletingId: string | undefined;
}

export function PropertyGrid({
	properties,
	allProperties,
	onDelete,
	isDeletingId,
}: PropertyGridProps) {
	if (properties.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
				<p className="text-muted-foreground">
					{allProperties.length === 0
						? "No properties yet. Add your first one!"
						: "No properties match your filters."}
				</p>
				{allProperties.length === 0 && (
					<Button className="mt-4">
						<Link href="/properties/new">Add Property</Link>
					</Button>
				)}
			</div>
		);
	}
	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{properties.map((property) => (
				<PropertyCard
					key={property.id}
					property={property}
					onDelete={onDelete}
					isDeleting={isDeletingId === property.id}
				/>
			))}
		</div>
	);
}
