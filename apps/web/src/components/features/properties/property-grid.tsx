import { Button } from "@rently/ui/components/button";
import type { Property } from "@rently/validators";
import Link from "next/link";
import { PropertyCard } from "./property-card";

interface PropertyGridProps {
	properties: Property[];
	allProperties: Property[];
	isLoading: boolean;
	isError: boolean;
	error: Error | null;
	onDelete: (id: string) => void;
	isDeletingId: string | undefined;
}

export function PropertyGrid({
	properties,
	allProperties,
	isLoading,
	isError,
	error,
	onDelete,
	isDeletingId,
}: PropertyGridProps) {
	if (isError) {
		return (
			<div className="col-span-12 flex flex-col items-center justify-center py-20 text-center">
				<p className="text-muted-foreground">
					{error?.message ?? "Failed to load properties"}
				</p>
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

	if (isLoading) {
		return (
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: 6 }).map((_, i) => (
					<div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />
				))}
			</div>
		);
	}

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
