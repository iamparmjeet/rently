// apps/web/src/components/features/properties/property-table.tsx
"use client";

import type { PropertyType } from "@rently/db/constants/rent-constants";
import { Button } from "@rently/ui/components/button";
import { ConfirmDialog } from "@rently/ui/shared/confirm-dialog";
import type { Property } from "@rently/validators";
import {
	IconBuildingStore,
	IconHome,
	IconPencil,
	IconTrash,
} from "@tabler/icons-react";
import Link from "next/link";

interface PropertyTableProps {
	properties: Property[];
	// WHY allProperties: to distinguish "empty because no data" from
	// "empty because filter returned nothing" — same pattern as PropertyGrid
	allProperties: Property[];
	onDelete: (id: string) => void;
	isDeletingId?: string;
}

export function PropertyTable({
	properties,
	allProperties,
	onDelete,
	isDeletingId,
}: PropertyTableProps) {
	if (properties.length === 0) {
		return <EmptyState hasData={allProperties.length > 0} />;
	}

	return (
		<div className="overflow-hidden rounded-xl border border-border bg-card">
			<div className="overflow-x-auto">
				<table className="w-full">
					<thead>
						<tr className="border-border border-b">
							<th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">
								Property
							</th>
							<th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">
								Type
							</th>
							<th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">
								Added
							</th>
							<th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs uppercase tracking-wider">
								Actions
							</th>
						</tr>
					</thead>

					<tbody className="divide-y divide-border">
						{properties.map((property) => (
							<PropertyRow
								key={property.id}
								property={property}
								onDelete={onDelete}
								isDeleting={isDeletingId === property.id}
							/>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

// ── Sub-component: one row ──

interface PropertyRowProps {
	property: Property;
	onDelete: (id: string) => void;
	isDeleting: boolean;
}

function PropertyRow({ property, onDelete, isDeleting }: PropertyRowProps) {
	const formattedDate = new Date(property.createdAt).toLocaleDateString(
		"en-IN",
		{ day: "2-digit", month: "short", year: "numeric" },
	);

	return (
		<tr
			data-deleting={isDeleting}
			className="transition-colors hover:bg-muted/50 data-[deleting=true]:pointer-events-none data-[deleting=true]:opacity-50"
		>
			{/* Property name + address */}
			<td className="px-4 py-4">
				<Link
					href={`/properties/${property.id}`}
					className="group flex items-center gap-3"
				>
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
						<PropertyTypeIcon type={property.type} />
					</div>
					<div>
						<p className="font-medium text-foreground transition-colors group-hover:text-foreground/70">
							{property.name}
						</p>
						<p className="line-clamp-1 text-muted-foreground text-sm">
							{property.address}
						</p>
					</div>
				</Link>
			</td>

			{/* Type */}
			<td className="px-4 py-4">
				<span className="text-muted-foreground text-sm capitalize">
					{property.type}
				</span>
			</td>

			{/* Created date */}
			<td className="px-4 py-4">
				<span className="text-muted-foreground text-sm">{formattedDate}</span>
			</td>

			{/* Actions */}
			<td className="px-4 py-4">
				<div className="flex items-center justify-end gap-1">
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						render={<Link href={`/properties/${property.id}/edit`} />}
					>
						<IconPencil className="h-4 w-4" />
						<span className="sr-only">Edit {property.name}</span>
					</Button>

					<ConfirmDialog
						trigger={
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
							>
								<IconTrash className="h-4 w-4" />
								<span className="sr-only">Delete {property.name}</span>
							</Button>
						}
						title={`Delete "${property.name}"?`}
						description="This will permanently delete the property and all associated data. This action cannot be undone."
						confirmLabel="Delete Property"
						destructive
						onConfirm={() => onDelete(property.id)}
						isLoading={isDeleting}
					/>
				</div>
			</td>
		</tr>
	);
}

// ── Sub-component: type icon ──
function PropertyTypeIcon({ type }: { type: PropertyType }) {
	if (type === "commercial") {
		return <IconBuildingStore className="h-5 w-5 text-muted-foreground" />;
	}

	return <IconHome className="h-5 w-5 text-muted-foreground" />;
}

// ── Sub-component: empty state

function EmptyState({ hasData }: { hasData: boolean }) {
	return (
		<div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
			<p className="text-muted-foreground">
				{hasData
					? "No properties match your filters."
					: "No properties yet. Add your first one!"}
			</p>
			{!hasData && (
				<Button className="mt-4" render={<Link href="/properties/new" />}>
					Add Property
				</Button>
			)}
		</div>
	);
}
