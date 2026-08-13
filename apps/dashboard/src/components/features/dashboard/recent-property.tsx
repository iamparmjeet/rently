"use client";

import { formatRupees } from "@rently/ui/lib/currency";
import { IconBuildingSkyscraper } from "@tabler/icons-react";
import Link from "next/link";
import { useProperties } from "@/hooks/properties";

const PREVIEW_COUNT = 4;

interface RecentPropertiesProps {
	className?: string;
}

// ── Skeleton row —
function PropertyRowSkeleton({ delay }: { delay: number }) {
	return (
		<div className="grid grid-cols-[1fr_3rem_6rem] items-center gap-3 py-3.5">
			<div className="flex items-center gap-3">
				<div
					className="size-9 shrink-0 animate-pulse rounded-xl bg-muted"
					style={{ animationDelay: `${delay}ms` }}
				/>
				<div className="space-y-1.5">
					<div
						className="h-3 w-32 animate-pulse rounded bg-muted"
						style={{ animationDelay: `${delay}ms` }}
					/>
					<div
						className="h-3 w-20 animate-pulse rounded bg-muted/60"
						style={{ animationDelay: `${delay + 50}ms` }}
					/>
				</div>
			</div>
			<div
				className="mx-auto h-3 w-8 animate-pulse rounded bg-muted"
				style={{ animationDelay: `${delay}ms` }}
			/>
			<div
				className="ml-auto h-3 w-14 animate-pulse rounded bg-muted"
				style={{ animationDelay: `${delay}ms` }}
			/>
		</div>
	);
}

export function RecentProperties({ className = "" }: RecentPropertiesProps) {
	const { data, isLoading } = useProperties();

	const recent = [...(data?.properties ?? [])]
		.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		)
		.slice(0, PREVIEW_COUNT);

	return (
		<div
			className={`rounded-2xl border border-border/40 bg-card p-6 shadow-sm ${className}`}
		>
			{/* ── Header ────── */}
			<div className="flex items-center justify-between">
				<h3 className="font-semibold text-base">Recent Properties</h3>
				<Link
					href="/properties"
					className="text-muted-foreground text-sm transition-colors hover:text-foreground"
				>
					View all →
				</Link>
			</div>

			{/* ── Column headers — grid matches data rows exactly ──────── */}
			<div className="mt-4 grid grid-cols-[1fr_3rem_6rem] items-center gap-3 border-border/40 border-b pb-2">
				<span className="text-muted-foreground text-xs uppercase tracking-wide">
					Property
				</span>
				<span className="text-center text-muted-foreground text-xs uppercase tracking-wide">
					Units
				</span>
				<span className="text-right text-muted-foreground text-xs uppercase tracking-wide">
					Revenue
				</span>
			</div>

			{/* ── Rows ──────── */}
			<div className="flex flex-col divide-y divide-border/40">
				{isLoading ? (
					Array.from({ length: PREVIEW_COUNT }).map((_, i) => (
						<PropertyRowSkeleton key={i} delay={i * 100} />
					))
				) : recent.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						No properties yet — add your first one to get started.
					</p>
				) : (
					recent.map((property) => (
						<div
							key={property.id}
							className="grid grid-cols-[1fr_3rem_6rem] items-center gap-3 py-3.5"
						>
							{/* Icon + name / address ─── */}
							<div className="flex min-w-0 items-center gap-3">
								<div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
									<IconBuildingSkyscraper className="size-4 text-primary" />
								</div>
								<div className="min-w-0">
									<p className="truncate font-medium text-sm">
										{property.name}
									</p>
									<p className="truncate text-muted-foreground text-xs">
										{property.address}
									</p>
								</div>
							</div>

							{/* Occupied / total ──*/}

							<span className="text-center text-muted-foreground text-sm tabular-nums">
								{property.occupiedUnits}/{property.totalUnits}
							</span>

							{/* Monthly revenue ────────────────────────────── */}

							<span className="text-right font-semibold text-emerald-600 text-sm tabular-nums">
								{formatRupees(property.monthlyRevenue)}
							</span>
						</div>
					))
				)}
			</div>
		</div>
	);
}
