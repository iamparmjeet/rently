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
import { formatRupees } from "@rently/ui/lib/currency";

import { cn } from "@rently/ui/lib/utils";
import type { UnitDetail } from "@rently/validators";
import {
	IconBuildingStore,
	IconChevronRight,
	IconHome,
	IconRuler,
} from "@tabler/icons-react";
import { format } from "date-fns";
import Link from "next/link";

interface UnitCardProps {
	unit: UnitDetail;
	showPropertyName?: boolean; // false on property detail page (redundant), true on /units page
	isDeleting?: boolean;
	actionsSlot?: React.ReactNode;
}

export function UnitCard({
	unit,
	showPropertyName = true,
	actionsSlot,
	isDeleting,
}: UnitCardProps) {
	const isOccupied = unit.status === "occupied";
	const isStudio = unit.type === "studio";

	return (
		<Card
			className={cn(
				"gap-0 overflow-hidden border-border/80 py-0 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md",
				isDeleting && "pointer-events-none opacity-50",
			)}
		>
			<CardHeader className="border-b bg-gradient-to-br from-primary/[0.10] via-primary/[0.025] to-transparent px-5 pt-5 pb-4">
				<div className="flex items-start justify-between gap-2">
					<div className="flex min-w-0 items-start gap-3">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
							{isStudio ? (
								<IconHome className="size-5" />
							) : (
								<IconBuildingStore className="size-5" />
							)}
						</div>
						<CardTitle className="min-w-0 pt-0.5">
							<p className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
								{unit.type}
							</p>
							<p className="truncate font-semibold text-base">
								Unit {unit.unitNumber}
							</p>
							{showPropertyName && (
								<p className="mt-1 truncate text-muted-foreground text-xs">
									{unit.propertyName}
								</p>
							)}
						</CardTitle>
					</div>

					{/* Actions Dropdown*/}
					{actionsSlot}
				</div>
			</CardHeader>

			<CardContent className="space-y-4 px-5 py-4">
				<div className="flex items-end justify-between gap-3">
					<div>
						<p className="text-muted-foreground text-xs">Monthly rent</p>
						<p className="mt-1 font-semibold text-lg tracking-tight">
							{formatRupees(unit.baseRent)}
							<span className="ml-1 font-normal text-muted-foreground text-xs">
								/mo
							</span>
						</p>
					</div>
					<Badge
						variant="outline"
						className={cn(
							"rounded-full px-2.5 capitalize",
							isOccupied
								? "border-emerald-200 bg-emerald-50 text-emerald-700"
								: "border-amber-200 bg-amber-50 text-amber-700",
						)}
					>
						{isOccupied ? "Occupied" : "Available"}
					</Badge>
				</div>
				<div className="flex items-center justify-between border-t pt-3 text-muted-foreground text-xs">
					{unit.area ? (
						<span className="flex items-center gap-1.5">
							<IconRuler className="size-3" />
							{unit.area.toLocaleString("en-IN")} sq ft
						</span>
					) : (
						<span>Area not recorded</span>
					)}
					<span className="capitalize">
						{unit.furnishing?.replaceAll("_", " ") ?? "Unfurnished"}
					</span>
				</div>
			</CardContent>

			<CardFooter className="flex items-center justify-between gap-3 border-t px-5 py-3.5">
				<p className="min-w-0 truncate text-muted-foreground text-xs">
					<span className="whitespace-nowrap">
						Created {format(new Date(unit.createdAt), "dd MMM yyyy")}
					</span>
					<span className="text-muted-foreground/60">&nbsp;·&nbsp;</span>
					<span className="whitespace-nowrap">
						Updated {format(new Date(unit.updatedAt), "dd MMM yyyy")}
					</span>
				</p>
				<Button
					nativeButton={false}
					variant="ghost"
					size="sm"
					className="shrink-0 text-primary"
					render={<Link href={`/units/${unit.id}`} />}
				>
					Open <IconChevronRight className="size-3.5" />
				</Button>
			</CardFooter>
		</Card>
	);
}
