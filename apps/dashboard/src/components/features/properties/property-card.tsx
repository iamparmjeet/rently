import { Badge } from "@rently/ui/components/badge";
import { Button } from "@rently/ui/components/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";

import { cn } from "@rently/ui/lib/utils";
import { DateRecordMeta } from "@rently/ui/shared/date-record-meta";
import { IconBuildingStore, IconHome } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { IconWrapper } from "@/components/shared/icon-wrapper";
import { orpc } from "@/utils/orpc";

export interface PropertyCardProps {
	property: {
		id: string;
		name: string;
		address: string;
		type: "residential" | "commercial";
		createdAt: Date;
		updatedAt: Date;
	};
	// Units are optional - card works without them (for list view)
	// They're shown when available (for detail preview)
	unitStats?: {
		totalProperties: number;
		occupiedUnits: number;
		totalUnits: number;
		availableUnits: number;
		monthlyRevenue: number;
	};
	onDelete?: (id: string) => void;
	isDeleting?: boolean;
	actionsSlot?: React.ReactNode;
}

export type PropertyUnitStats = NonNullable<PropertyCardProps["unitStats"]>;

export function PropertyCard({
	property,
	unitStats,
	isDeleting,
	actionsSlot,
}: PropertyCardProps) {
	const queryClient = useQueryClient();

	const occupancyRate = unitStats
		? unitStats.totalUnits > 0
			? Math.round((unitStats.occupiedUnits / unitStats.totalUnits) * 100)
			: 0
		: null;

	function handleMouseEnter() {
		// Prefetch the property detail
		queryClient.prefetchQuery(
			orpc.rent.property.getPropertyById.queryOptions({
				input: { id: property.id },
			}),
		);

		// Prefetch the units for this property.
		// The detail page will need these — prefetch them together.
		queryClient.prefetchQuery(
			orpc.rent.unit.listUnits.queryOptions({ input: {} }),
		);
	}
	const isResidential = property.type === "residential";

	return (
		<Card
			className={cn(
				"flex flex-col transition-all",
				isDeleting && "pointer-events-none opacity-50",
			)}
			onMouseEnter={handleMouseEnter}
		>
			<CardHeader className="">
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-2">
						<IconWrapper>
							{isResidential ? (
								<IconHome className="size-6 shrink-0 text-blue-500" />
							) : (
								<IconBuildingStore className="size-6 shrink-0 text-blue-500" />
							)}
						</IconWrapper>
						<CardTitle className="line-clamp-1 text-base">
							<p className="font-bold text-lg">{property.name}</p>
							<p className="line-clamp-1 text-gray-500 text-xs capitalize">
								{property.address}
							</p>
						</CardTitle>
					</div>

					{/* Actions Dropdown */}
					{actionsSlot}
				</div>
			</CardHeader>

			{/* Unit Stats — only rendered if unitStats provided */}
			{unitStats && (
				<CardContent className="">
					<div className="grid grid-cols-3 gap-2 text-center">
						<div className="rounded-md bg-muted p-2">
							<p className="font-semibold text-lg">{unitStats.totalUnits}</p>
							<p className="text-muted-foreground text-xs">Total</p>
						</div>
						<div className="rounded-md bg-muted p-2">
							<p className="font-semibold text-green-600 text-lg">
								{unitStats.occupiedUnits}
							</p>
							<p className="text-muted-foreground text-xs">Occupied</p>
						</div>
						<div className="rounded-md bg-muted p-2">
							<p className="font-semibold text-lg text-orange-500">
								{unitStats.availableUnits}
							</p>
							<p className="text-muted-foreground text-xs">Vacant</p>
						</div>
					</div>

					{/* Occupancy bar */}
					{occupancyRate !== null && (
						<div className="mt-3">
							<div className="mb-1 flex justify-between text-muted-foreground text-xs">
								<span>Occupancy</span>
								<span>{occupancyRate}%</span>
							</div>
							<div className="h-1.5 w-full rounded-full bg-muted">
								<div
									className="h-full rounded-full bg-primary transition-all"
									style={{ width: `${occupancyRate}%` }}
								/>
							</div>
						</div>
					)}
				</CardContent>
			)}

			<CardFooter className="flex w-full flex-col gap-4">
				<div className="flex w-full items-center justify-between">
					<Badge
						variant="outline"
						className={cn(
							"rounded text-xs",
							isResidential
								? "border-blue-200 bg-blue-50 text-blue-700"
								: "border-amber-200 bg-amber-50 text-amber-700",
						)}
					>
						{property.type}
					</Badge>
					{/*{unitStats && (
						<span className="ml-auto font-medium text-muted-foreground text-xs">
							₹{unitStats?.monthlyRevenue.toLocaleString("en-IN")}/mo
						</span>
					)}*/}
					<Button variant="outline" size="sm" className="ml-auto">
						<Link href={`/properties/${property.id}`}>View</Link>
					</Button>
				</div>
				<DateRecordMeta
					className="w-full"
					createdAt={property.createdAt}
					updatedAt={property.updatedAt}
				/>
			</CardFooter>
		</Card>
	);
}
