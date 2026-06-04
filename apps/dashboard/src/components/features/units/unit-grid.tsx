import { EmptyState } from "@rently/ui/shared/empty-state";
import type { UnitDetail } from "@rently/validators";
import { IconLayoutBoard } from "@tabler/icons-react";
import { AddUnitButton } from "./add-unit-button";
import { UnitCardActions } from "./unit-card-action";

// ── Types ─────

interface UnitGridProps {
	units: UnitDetail[]; // filtered result — may be empty due to active filters
	allUnits: UnitDetail[]; // full unfiltered list — tells us WHY it's empty
	isLoading?: boolean;
	isDeletingId?: string;
}

// ── Component ───

export function UnitGrid({ units, allUnits, isLoading }: UnitGridProps) {
	// Guard 1 — loading state
	if (isLoading) {
		return <UnitGridSkeleton />;
	}

	// Guard 2 — empty state
	// WHY: allUnits.length distinguishes "no data at all" from
	// "data exists but filters returned nothing" — same pattern as PropertyGrid.
	// This is critical for correct CTA placement: only show AddUnitButton
	// when there are truly zero units, not when filters exclude them all.
	if (units.length === 0) {
		const hasData = allUnits.length > 0;
		return (
			<EmptyState
				icon={IconLayoutBoard}
				title={hasData ? "No units match your filters" : "No units yet"}
				description={
					hasData
						? "Try adjusting your search or filter criteria."
						: "Add your first unit to start tracking occupancy."
				}
				className="rounded-md bg-white shadow"
			>
				{!hasData && <AddUnitButton />}
			</EmptyState>
		);
	}

	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{units.map((unit) => (
				<UnitCardActions key={unit.id} unit={unit} />
			))}
		</div>
	);
}

function UnitGridSkeleton() {
	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{Array.from({ length: 6 }).map((_, i) => (
				<div key={i} className="h-44 animate-pulse rounded-xl bg-muted" />
			))}
		</div>
	);
}
