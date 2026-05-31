import { IconUsers } from "@tabler/icons-react";

// ─── Private ring constants + helpers ────────────────────────

const RING_RADIUS = 46;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ≈ 289

function ringColor(rate: number): string {
	if (rate >= 80) return "#10b981"; // emerald-500
	if (rate >= 50) return "#f59e0b"; // amber-500
	return "#ef4444"; // rose-500
}

function ringTextClass(rate: number): string {
	if (rate >= 80) return "text-emerald-500";
	if (rate >= 50) return "text-amber-500";
	return "text-rose-500";
}

// ─── Private sub-component ─────────

interface OccupancyRingProps {
	rate: number;
	isLoading: boolean;
}

function OccupancyRing({ rate, isLoading }: OccupancyRingProps) {
	const offset = isLoading
		? RING_CIRCUMFERENCE
		: RING_CIRCUMFERENCE * (1 - rate / 100);

	return (
		<div className="relative inline-flex shrink-0 items-center justify-center">
			<svg
				width={108}
				height={108}
				viewBox="0 0 108 108"
				style={{ transform: "rotate(-90deg)" }}
				aria-hidden="true"
			>
				<circle
					cx={54}
					cy={54}
					r={RING_RADIUS}
					fill="none"
					strokeWidth={7}
					className="stroke-muted"
				/>
				<circle
					cx={54}
					cy={54}
					r={RING_RADIUS}
					fill="none"
					strokeWidth={7}
					strokeLinecap="round"
					stroke={isLoading ? "transparent" : ringColor(rate)}
					strokeDasharray={RING_CIRCUMFERENCE}
					strokeDashoffset={offset}
					style={{
						transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)",
					}}
				/>
			</svg>

			<div className="absolute flex flex-col items-center">
				{isLoading ? (
					<div className="h-6 w-12 animate-pulse rounded-md bg-muted" />
				) : (
					<span
						className={`font-bold text-xl tabular-nums leading-none ${ringTextClass(rate)}`}
					>
						{rate}%
					</span>
				)}
				<span className="mt-0.5 text-[10px] text-muted-foreground leading-none">
					filled
				</span>
			</div>
		</div>
	);
}

// ─── Private skeleton ──────

function Skeleton({ className }: { className?: string }) {
	return (
		<div className={`animate-pulse rounded-lg bg-muted ${className ?? ""}`} />
	);
}

// ─── Public component ───────

interface OccupancyCardProps {
	occupancyRate: number;
	occupiedUnits: number;
	availableUnits: number;
	isLoading: boolean;
	className?: string;
}

export function OccupancyCard({
	occupancyRate,
	occupiedUnits,
	availableUnits,
	isLoading,
	className = "",
}: OccupancyCardProps) {
	return (
		<div
			className={`rounded-2xl border border-border/40 bg-card p-6 shadow-sm ${className}`}
		>
			<div className="flex items-start justify-between">
				<div className="rounded-xl bg-emerald-500/10 p-2.5">
					<IconUsers className="size-5 text-emerald-500" />
				</div>
				<span className="text-muted-foreground text-xs">Occupancy rate</span>
			</div>

			<div className="mt-4 flex items-center gap-5">
				<OccupancyRing rate={occupancyRate} isLoading={isLoading} />

				<div className="flex flex-col gap-3.5">
					<div>
						<p className="text-[10px] text-muted-foreground uppercase tracking-widest">
							Occupied
						</p>
						{isLoading ? (
							<Skeleton className="mt-1.5 h-6 w-10" />
						) : (
							<p className="font-semibold text-xl tabular-nums leading-none">
								{occupiedUnits}
							</p>
						)}
					</div>
					<div>
						<p className="text-[10px] text-muted-foreground uppercase tracking-widest">
							Available
						</p>
						{isLoading ? (
							<Skeleton className="mt-1.5 h-6 w-10" />
						) : (
							<p className="font-semibold text-xl tabular-nums leading-none">
								{availableUnits}
							</p>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
