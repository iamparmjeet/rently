import { Badge } from "@rently/ui/components/badge";
import { Button } from "@rently/ui/components/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@rently/ui/components/dropdown-menu";
import { cn } from "@rently/ui/lib/utils";
import {
	IconBuildingStore,
	IconDots,
	IconHome,
	IconPencil,
	IconTrash,
} from "@tabler/icons-react";
import Link from "next/link";

interface PropertyCardProps {
	property: {
		id: string;
		name: string;
		address: string;
		type: "residential" | "commercial";
	};
	// Units are optional - card works without them (for list view)
	// They're shown when available (for detail preview)
	unitStats?: {
		total: number;
		occupied: number;
		vacant: number;
		monthlyRevenue: number;
	};
	onDelete?: (id: string) => void;
	isDeleting?: boolean;
}

export function PropertyCard({
	property,
	unitStats,
	onDelete,
	isDeleting,
}: PropertyCardProps) {
	const occupancyRate = unitStats
		? unitStats.total > 0
			? Math.round((unitStats.occupied / unitStats.total) * 100)
			: 0
		: null;

	return (
		<Card
			className={cn(
				"transition-all hover:shadow-md",
				isDeleting && "pointer-events-none opacity-50",
			)}
		>
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between gap-2">
					<div className="flex items-center gap-2">
						{property.type === "residential" ? (
							<IconHome className="h-4 w-4 shrink-0 text-muted-foreground" />
						) : (
							<IconBuildingStore className="h-4 w-4 shrink-0 text-muted-foreground" />
						)}
						<CardTitle className="line-clamp-1 text-base">
							{property.name}
						</CardTitle>
					</div>

					{/* Actions Dropdown */}
					<DropdownMenu>
						<DropdownMenuTrigger>
							<IconDots className="h-4 w-4" />
							<span className="sr-only">Open menu</span>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem>
								<Link
									href={`/properties/${property.id}/edit`}
									className="flex items-center"
								>
									<IconPencil className="mr-2 h-4 w-4" />
									Edit
								</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								className="text-destructive focus:text-destructive"
								onClick={() => onDelete?.(property.id)}
							>
								<IconTrash className="mr-2 h-4 w-4" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				<p className="line-clamp-1 text-muted-foreground text-xs">
					{property.address}
				</p>
			</CardHeader>

			{/* Unit Stats — only rendered if unitStats provided */}
			{unitStats && (
				<CardContent className="pb-3">
					<div className="grid grid-cols-3 gap-2 text-center">
						<div className="rounded-md bg-muted/50 p-2">
							<p className="font-semibold text-lg">{unitStats.total}</p>
							<p className="text-muted-foreground text-xs">Total</p>
						</div>
						<div className="rounded-md bg-muted/50 p-2">
							<p className="font-semibold text-green-600 text-lg">
								{unitStats.occupied}
							</p>
							<p className="text-muted-foreground text-xs">Occupied</p>
						</div>
						<div className="rounded-md bg-muted/50 p-2">
							<p className="font-semibold text-lg text-orange-500">
								{unitStats.vacant}
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

			<CardFooter className="gap-2 pt-0">
				<Badge variant="outline" className="text-xs">
					{property.type}
				</Badge>
				{unitStats && (
					<span className="ml-auto font-medium text-muted-foreground text-xs">
						₹{unitStats.monthlyRevenue.toLocaleString("en-IN")}/mo
					</span>
				)}
				<Button variant="outline" size="sm" className="ml-auto">
					<Link href={`/properties/${property.id}`}>View</Link>
				</Button>
			</CardFooter>
		</Card>
	);
}
