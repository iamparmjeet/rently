import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
} from "@rently/ui/components/card";
import { Skeleton } from "@rently/ui/components/skeleton";

interface PropertyCardSkeletonProps {
	animationDelay?: number;
}

export function PropertyCardSkeleton({
	animationDelay = 0,
}: PropertyCardSkeletonProps) {
	return (
		<Card
			className="flex flex-col"
			style={{ animationDelay: `${animationDelay}ms` }}
		>
			{/* ── Header: icon + name/address + actions dot menu ── */}
			<CardHeader>
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-2">
						{/* IconWrapper */}
						<Skeleton className="size-9 rounded-md" />
						<div className="space-y-1.5">
							{/* property.name */}
							<Skeleton className="h-4 w-32" />
							{/* property.address */}
							<Skeleton className="h-3 w-24" />
						</div>
					</div>
					{/* actionsSlot (three-dot menu) */}
					<Skeleton className="size-8 rounded-md" />
				</div>
			</CardHeader>

			{/* ── Content: 3 stat boxes + occupancy bar ── */}
			<CardContent>
				{/* mirrors the grid-cols-3 stat grid */}
				<div className="grid grid-cols-3 gap-2">
					{Array.from({ length: 3 }).map((_, i) => (
						<Skeleton key={i} className="h-14 rounded-md" />
					))}
				</div>

				{/* occupancy bar section */}
				<div className="mt-3 space-y-1.5">
					<div className="flex justify-between">
						<Skeleton className="h-3 w-16" />
						<Skeleton className="h-3 w-8" />
					</div>
					<Skeleton className="h-1.5 w-full rounded-full" />
				</div>
			</CardContent>

			{/* ── Footer: badge + view button + DateRecordMeta ── */}
			<CardFooter className="flex w-full flex-col gap-4">
				<div className="flex w-full items-center justify-between">
					{/* type badge */}
					<Skeleton className="h-5 w-20 rounded" />
					{/* View button */}
					<Skeleton className="h-8 w-16 rounded-md" />
				</div>
				{/* DateRecordMeta — spans full width */}
				<Skeleton className="h-3 w-full rounded" />
			</CardFooter>
		</Card>
	);
}
