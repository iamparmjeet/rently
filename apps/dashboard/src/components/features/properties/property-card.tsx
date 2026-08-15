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
import { IconWrapper } from "@rently/ui/shared/icon-wrapper";
import type { PropertyWithStats } from "@rently/validators";
import {
	IconBuildingStore,
	IconChevronRight,
	IconHome,
} from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import Link from "next/link";
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
	const tone = isResidential
		? {
				header: "from-blue-500/[0.12] via-blue-500/[0.03] to-transparent",
				icon: "bg-blue-600 text-white shadow-blue-500/20",
				badge: "border-blue-200 bg-blue-50 text-blue-700",
				progress: "bg-blue-600",
			}
		: {
				header: "from-amber-500/[0.14] via-amber-500/[0.03] to-transparent",
				icon: "bg-amber-500 text-white shadow-amber-500/20",
				badge: "border-amber-200 bg-amber-50 text-amber-700",
				progress: "bg-amber-500",
			};

	return (
		<Card
			className={cn(
				"relative gap-0 overflow-hidden border-border/80 py-0 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md",
				isDeleting && "pointer-events-none opacity-50",
			)}
			onMouseEnter={handleMouseEnter}
		>
			<CardHeader
				className={cn(
					"relative border-b bg-gradient-to-br px-5 pt-5 pb-4",
					tone.header,
				)}
			>
				<div className="flex items-start justify-between">
					<div className="flex min-w-0 items-start gap-3">
						<IconWrapper
							className={cn(
								"mt-0.5 size-10 shrink-0 rounded-xl shadow-lg",
								tone.icon,
							)}
						>
							{isResidential ? (
								<IconHome className="size-5 shrink-0" />
							) : (
								<IconBuildingStore className="size-5 shrink-0" />
							)}
						</IconWrapper>
						<CardTitle className="min-w-0 pt-0.5">
							<p className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
								{property.type} property
							</p>
							<p className="truncate font-semibold text-base">
								{property.name}
							</p>
							<p className="mt-1 line-clamp-1 text-muted-foreground text-xs">
								{property.address}
							</p>
						</CardTitle>
					</div>

					{/* Actions Dropdown */}
					{actionsSlot}
				</div>
			</CardHeader>

			<CardContent className="space-y-4 bg-card px-5 py-4">
				<div className="flex items-end justify-between gap-3">
					<div>
						<p className="text-muted-foreground text-xs">Monthly revenue</p>
						<p className="mt-1 font-semibold text-lg tracking-tight">
							₹{property.monthlyRevenue.toLocaleString("en-IN")}
							<span className="ml-1 font-normal text-muted-foreground text-xs">
								/mo
							</span>
						</p>
					</div>
					<Badge
						variant="outline"
						className={cn("rounded-full px-2.5 capitalize", tone.badge)}
					>
						{property.type}
					</Badge>
				</div>
				<div>
					<div className="mb-2 flex items-center justify-between text-xs">
						<span className="font-medium text-foreground">
							{occupancyRate}% occupied
						</span>
						<span className="text-muted-foreground">
							{property.occupiedUnits} of {property.totalUnits} units
						</span>
					</div>
					<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
						<div
							className={cn(
								"h-full rounded-full transition-all",
								tone.progress,
							)}
							style={{ width: `${occupancyRate}%` }}
						/>
					</div>
					<div className="mt-2 flex gap-3 text-xs">
						<span className="text-emerald-700">
							{property.occupiedUnits} occupied
						</span>
						<span className="text-amber-700">
							{property.availableUnits} available
						</span>
					</div>
				</div>
			</CardContent>

			<CardFooter className="flex w-full items-center justify-between gap-3 border-t px-5 py-3.5">
				<p className="min-w-0 truncate text-muted-foreground text-xs">
					<span className="whitespace-nowrap">
						Created {format(new Date(property.createdAt), "dd MMM yyyy")}
					</span>
					<span className="text-muted-foreground/60">&nbsp;·&nbsp;</span>
					<span className="whitespace-nowrap">
						Updated {format(new Date(property.updatedAt), "dd MMM yyyy")}
					</span>
				</p>
				<Button
					nativeButton={false}
					variant="ghost"
					size="sm"
					className="shrink-0 text-primary"
					render={<Link href={`/properties/${property.id}`} />}
				>
					Open
					<IconChevronRight className="size-3.5" />
				</Button>
			</CardFooter>
		</Card>
	);
}
