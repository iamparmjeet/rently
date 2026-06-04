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

import { cn } from "@rently/ui/lib/utils";
import { DateRecordMeta } from "@rently/ui/shared/date-record-meta";
import type { UnitDetail } from "@rently/validators";
import { IconBuildingStore, IconHome, IconRuler } from "@tabler/icons-react";
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
						{unit.type === "studio" ? (
							<IconHome className="size-4 shrink-0 text-muted-foreground" />
						) : (
							<IconBuildingStore className="size-4 shrink-0 text-muted-foreground" />
						)}
						<CardTitle className="text-base">Unit {unit.unitNumber}</CardTitle>
					</div>

					{/* Actions Dropdown*/}
					{actionsSlot}
				</div>

				{/* Property name — shown on /units list page */}
				{showPropertyName && (
					<p className="text-muted-foreground text-xs">{unit.propertyName}</p>
				)}
			</CardHeader>

			<CardContent className="pb-3">
				<div className="grid grid-cols-2 gap-3">
					<div className="rounded-md bg-muted/70 p-3">
						<p className="text-muted-foreground text-xs">Monthly Rent</p>
						<p className="mt-2 font-semibold">
							₹{unit.baseRent.toLocaleString("en-IN")}
						</p>
					</div>
					<div className="rounded-md bg-muted/70 p-3">
						<p className="text-muted-foreground text-xs">Status</p>
						<Badge
							variant={isOccupied ? "default" : "secondary"}
							className="mt-2 px-0 text-xs capitalize"
						>
							{unit.status}
						</Badge>
					</div>
				</div>

				{unit.area && (
					<div className="mt-3 flex items-center gap-1 rounded-md bg-muted/70 p-3 text-muted-foreground text-xs">
						<IconRuler className="size-3" />
						<p>
							Area: <span className="text-foreground">{unit.area} sq ft</span>
						</p>
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

			<DateRecordMeta
				className="px-2"
				createdAt={unit.createdAt}
				updatedAt={unit.updatedAt}
			/>
		</Card>
	);
}
