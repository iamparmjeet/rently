"use client";

import { Button } from "@rently/ui/components/button";
import { Skeleton } from "@rently/ui/components/skeleton";
import { EmptyState } from "@rently/ui/shared/empty-state";
import type { UtilityListItem } from "@rently/validators";
import { IconBolt, IconPlus } from "@tabler/icons-react";
import { UtilityCardActions } from "./utility-card-actions";

interface UtilityGridProps {
	utilities: UtilityListItem[];
	allUtilities: UtilityListItem[];
	isLoading?: boolean;
	onCreate?: () => void;
}

export function UtilityGrid({
	utilities,
	allUtilities,
	isLoading,
	onCreate,
}: UtilityGridProps) {
	if (isLoading) {
		return (
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: 6 }).map((_, i) => (
					<UtilityCardSkeleton key={i} />
				))}
			</div>
		);
	}

	if (utilities.length === 0) {
		return (
			<EmptyState
				icon={IconBolt}
				title={
					allUtilities.length === 0
						? "No utility readings yet"
						: "No readings match these filters"
				}
				description={
					allUtilities.length === 0
						? "Record your first electricity, water, or maintenance reading to start tracking usage and charges."
						: "Try adjusting your search or status filter."
				}
			>
				{allUtilities.length === 0 && onCreate ? (
					<Button onClick={onCreate}>
						<IconPlus className="size-4" />
						Add Reading
					</Button>
				) : null}
			</EmptyState>
		);
	}

	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{utilities.map((utility) => (
				<UtilityCardActions key={utility.id} utility={utility} />
			))}
		</div>
	);
}

function UtilityCardSkeleton() {
	return (
		<div className="overflow-hidden rounded-lg border border-border/80 bg-card">
			{/* Header */}
			<div className="space-y-3 border-b px-5 pt-5 pb-4">
				<div className="flex items-start justify-between">
					<div className="flex items-start gap-3">
						<Skeleton className="size-10 rounded-xl" />
						<div className="space-y-1.5 pt-0.5">
							<Skeleton className="h-3 w-16" />
							<Skeleton className="h-4 w-28" />
							<Skeleton className="h-3 w-36" />
						</div>
					</div>
					<Skeleton className="h-5 w-14 rounded-full" />
				</div>
			</div>
			{/* Content */}
			<div className="space-y-3 px-5 py-4">
				<div className="flex items-end justify-between gap-3">
					<Skeleton className="h-12 w-20" />
					<Skeleton className="h-12 w-24" />
				</div>
				<div className="space-y-1.5">
					<Skeleton className="h-3 w-full" />
					<Skeleton className="h-3 w-3/4" />
				</div>
			</div>
			{/* Footer */}
			<div className="flex items-center justify-between border-t px-5 py-3.5">
				<Skeleton className="h-3 w-40" />
				<Skeleton className="size-7 rounded-md" />
			</div>
		</div>
	);
}
