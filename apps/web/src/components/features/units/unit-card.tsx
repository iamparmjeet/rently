// apps/web/src/components/features/units/unit-card.tsx

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
import type { UnitWithPropertyName } from "@rently/validators";

import {
	IconBuildingStore,
	IconDots,
	IconHome,
	IconPencil,
	IconRuler,
	IconTrash,
} from "@tabler/icons-react";
import Link from "next/link";

interface UnitCardProps {
	unit: UnitWithPropertyName;
	showPropertyName?: boolean; // false on property detail page (redundant), true on /units page
	onDelete?: (id: string) => void;
	isDeleting?: boolean;
}

export function UnitCard({
	unit,
	showPropertyName = true,
	onDelete,
	isDeleting,
}: UnitCardProps) {
	const isOccupied = unit.status === "occupied";

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
						{unit.type === "room" ? (
							<IconHome className="size-4 shrink-0 text-muted-foreground" />
						) : (
							<IconBuildingStore className="size-4 shrink-0 text-muted-foreground" />
						)}
						<CardTitle className="text-base">Unit {unit.unitNumber}</CardTitle>
					</div>

					<DropdownMenu>
						<DropdownMenuTrigger>
							<button type="button" className="rounded p-1 hover:bg-muted">
								<IconDots className="size-4" />
								<span className="sr-only">Open menu</span>
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem>
								<Link
									href={`/units/${unit.id}/edit`}
									className="flex items-center"
								>
									<IconPencil className="mr-2 size-4" />
									Edit
								</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								className="text-destructive focus:text-destructive"
								onClick={() => onDelete?.(unit.id)}
							>
								<IconTrash className="mr-2 size-4" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{/* Property name — shown on /units list page */}
				{showPropertyName && (
					<p className="text-muted-foreground text-xs">{unit.propertyName}</p>
				)}
			</CardHeader>

			<CardContent className="pb-3">
				<div className="grid grid-cols-2 gap-3">
					<div className="rounded-md bg-muted/50 p-3">
						<p className="text-muted-foreground text-xs">Monthly Rent</p>
						<p className="font-semibold">
							₹{unit.baseRent.toLocaleString("en-IN")}
						</p>
					</div>
					<div className="rounded-md bg-muted/50 p-3">
						<p className="text-muted-foreground text-xs">Status</p>
						<Badge
							variant={isOccupied ? "default" : "secondary"}
							className="mt-0.5 text-xs capitalize"
						>
							{unit.status}
						</Badge>
					</div>
				</div>

				{unit.area && (
					<div className="mt-3 flex items-center gap-1 text-muted-foreground text-xs">
						<IconRuler className="size-3" />
						<span>{unit.area} sq ft</span>
					</div>
				)}
			</CardContent>

			<CardFooter className="gap-2 pt-0">
				<Badge variant="outline" className="text-xs capitalize">
					{unit.type}
				</Badge>
				<Button variant="outline" size="sm" className="ml-auto">
					<Link href={`/units/${unit.id}`}>View</Link>
				</Button>
			</CardFooter>
		</Card>
	);
}
