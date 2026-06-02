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
import type { PropertyWithStats } from "@rently/validators";
import { IconBuildingStore, IconHome } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { IconWrapper } from "@/components/shared/icon-wrapper";
import { orpc } from "@/utils/orpc";

export interface PropertyCardProps {
	property: PropertyWithStats;
	isDeleting?: boolean;
	actionsSlot?: React.ReactNode;
}

export function PropertyCard({
	property,
	isDeleting,
	actionsSlot,
}: PropertyCardProps) {
	const queryClient = useQueryClient();

	const occupancyRate =
		property.totalUnits > 0
			? Math.round((property.occupiedUnits / property.totalUnits) * 100)
			: 0;

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
			orpc.rent.unit.listUnits.queryOptions({
				input: {
					propertyId: property.id,
				},
			}),
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

			<CardContent className="">
				<div className="grid grid-cols-3 gap-2 text-center">
					<div className="rounded-md bg-muted p-2">
						<p className="font-semibold text-lg">
							{property ? property.totalUnits : "0"}
						</p>
						<p className="text-muted-foreground text-xs">Total</p>
					</div>
					<div className="rounded-md bg-muted p-2">
						<p className="font-semibold text-green-600 text-lg">
							{property ? property.occupiedUnits : "0"}
						</p>
						<p className="text-muted-foreground text-xs">Occupied</p>
					</div>
					<div className="rounded-md bg-muted p-2">
						<p className="font-semibold text-lg text-orange-500">
							{property ? property.availableUnits : "0"}
						</p>
						<p className="text-muted-foreground text-xs">Vacant</p>
					</div>
				</div>

				{/* Occupancy bar */}

				<div className="mt-3">
					<div className="mb-1 flex justify-between text-muted-foreground text-xs">
						<span>Occupancy</span>
						<span>{occupancyRate ? occupancyRate : 0}%</span>
					</div>
					<div className="h-1.5 w-full rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-primary transition-all"
							style={{ width: `${occupancyRate ? occupancyRate : 0}%` }}
						/>
					</div>
				</div>
			</CardContent>

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

					<span className="ml-auto font-medium text-muted-foreground text-xs">
						₹{property?.monthlyRevenue.toLocaleString("en-IN")}/mo
					</span>

					<Button
						nativeButton={false}
						variant="outline"
						size="sm"
						className="ml-auto"
						render={<Link href={`/properties/${property.id}`} />}
					>
						View
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
