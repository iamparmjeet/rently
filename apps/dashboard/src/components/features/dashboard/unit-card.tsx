import { IconArrowUpRight, IconHome2 } from "@tabler/icons-react";
import Link from "next/link";
import { StatNumber } from "./stat-number";

// ─── Private sub-component ────────────────────────────────────

interface UnitSplitBarProps {
	occupied: number;
	total: number;
	isLoading: boolean;
}

function UnitSplitBar({ occupied, total, isLoading }: UnitSplitBarProps) {
	const pct = total > 0 ? (occupied / total) * 100 : 0;

	return (
		<div className="mt-auto flex flex-col gap-2">
			<div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
				{isLoading ? (
					<div className="h-full w-1/2 animate-pulse rounded-full bg-muted-foreground/20" />
				) : (
					<div
						className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-1000 ease-out"
						style={{ width: `${pct}%` }}
					/>
				)}
			</div>

			<div className="flex justify-between text-muted-foreground text-xs">
				{isLoading ? (
					<>
						<div className="h-3 w-20 animate-pulse rounded bg-muted" />
						<div className="h-3 w-20 animate-pulse rounded bg-muted" />
					</>
				) : (
					<>
						<span>
							<span className="font-medium text-foreground tabular-nums">
								{occupied}
							</span>{" "}
							occupied
						</span>
						<span>
							<span className="font-medium text-foreground tabular-nums">
								{total - occupied}
							</span>{" "}
							available
						</span>
					</>
				)}
			</div>
		</div>
	);
}

// ─── Public component ─────────────────────────────────────────

interface UnitsCardProps {
	totalUnits: number;
	occupiedUnits: number;
	isLoading: boolean;
	className?: string;
}

export function UnitsCard({
	totalUnits,
	occupiedUnits,
	isLoading,
	className = "",
}: UnitsCardProps) {
	return (
		<div
			className={`flex flex-col rounded-2xl border border-border/40 bg-card p-6 shadow-sm ${className}`}
		>
			<div className="flex items-start justify-between">
				<div className="rounded-xl bg-blue-500/10 p-2.5">
					<IconHome2 className="size-5 text-blue-500" />
				</div>
				<Link
					href="/units"
					className="group flex items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground"
				>
					View all
					<IconArrowUpRight className="size-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
				</Link>
			</div>

			<div className="mt-5">
				<StatNumber value={totalUnits} isLoading={isLoading} />
				<p className="mt-1.5 font-medium text-muted-foreground text-sm">
					Total Units
				</p>
			</div>

			{/* WHY: mt-auto on UnitSplitBar pushes it to the bottom of the
			    flex column regardless of how tall the card grows in the grid row. */}
			<UnitSplitBar
				occupied={occupiedUnits}
				total={totalUnits}
				isLoading={isLoading}
			/>
		</div>
	);
}
