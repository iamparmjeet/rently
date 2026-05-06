import {
	IconBuildingStore,
	IconDots,
	IconHome,
	IconPencil,
	IconTrash,
} from "@tabler/icons-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

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
				isDeleting && "opacity-50 pointer-events-none",
			)}
		>
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between gap-2">
					<div className="flex items-center gap-2">
						{property.type === "residential" ? (
							<IconHome className="h-4 w-4 text-muted-foreground shrink-0" />
						) : (
							<IconBuildingStore className="h-4 w-4 text-muted-foreground shrink-0" />
						)}
						<CardTitle className="text-base line-clamp-1">
							{property.name}
						</CardTitle>
					</div>

					{/* Actions Dropdown */}
					<DropdownMenu>
						<DropdownMenuTrigger>
							<Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
								<IconDots className="h-4 w-4" />
								<span className="sr-only">Open menu</span>
							</Button>
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

				<p className="text-xs text-muted-foreground line-clamp-1">
					{property.address}
				</p>
			</CardHeader>

			{/* Unit Stats — only rendered if unitStats provided */}
			{unitStats && (
				<CardContent className="pb-3">
					<div className="grid grid-cols-3 gap-2 text-center">
						<div className="rounded-md bg-muted/50 p-2">
							<p className="text-lg font-semibold">{unitStats.total}</p>
							<p className="text-xs text-muted-foreground">Total</p>
						</div>
						<div className="rounded-md bg-muted/50 p-2">
							<p className="text-lg font-semibold text-green-600">
								{unitStats.occupied}
							</p>
							<p className="text-xs text-muted-foreground">Occupied</p>
						</div>
						<div className="rounded-md bg-muted/50 p-2">
							<p className="text-lg font-semibold text-orange-500">
								{unitStats.vacant}
							</p>
							<p className="text-xs text-muted-foreground">Vacant</p>
						</div>
					</div>

					{/* Occupancy bar */}
					{occupancyRate !== null && (
						<div className="mt-3">
							<div className="flex justify-between text-xs text-muted-foreground mb-1">
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

			<CardFooter className="pt-0 gap-2">
				<Badge variant="outline" className="text-xs">
					{property.type}
				</Badge>
				{unitStats && (
					<span className="ml-auto text-xs font-medium text-muted-foreground">
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
