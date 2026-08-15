"use client";

import { formatRupees } from "@rently/ui/lib/currency";
import { IconBuildingSkyscraper } from "@tabler/icons-react";
import Link from "next/link";
import { useProperties } from "@/hooks/properties";

const PREVIEW_COUNT = 4;

interface RecentPropertiesProps {
	className?: string;
}

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
			className={`overflow-hidden rounded-xl border bg-card shadow-sm ${className}`}
		>
			<div className="border-b bg-gradient-to-br from-primary/[0.10] via-primary/[0.025] to-transparent px-5 pt-5 pb-4">
				<div className="flex items-center justify-between">
					<div>
						<p className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
							Portfolio
						</p>
						<h3 className="mt-0.5 font-semibold text-sm">Recent properties</h3>
					</div>
					<Link
						href="/properties"
						className="text-muted-foreground text-xs transition-colors hover:text-foreground"
					>
						View all →
					</Link>
				</div>
			</div>

			<div className="px-5">
				<div className="grid grid-cols-[1fr_3rem_6rem] items-center gap-3 border-b py-3">
					<span className="text-muted-foreground text-xs uppercase tracking-[0.14em]">
						Property
					</span>
					<span className="text-center text-muted-foreground text-xs uppercase tracking-[0.14em]">
						Units
					</span>
					<span className="text-right text-muted-foreground text-xs uppercase tracking-[0.14em]">
						Revenue
					</span>
				</div>

				<div className="flex flex-col divide-y">
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
								<div className="flex min-w-0 items-center gap-3">
									<div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
										<IconBuildingSkyscraper className="size-4" />
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

								<span className="text-center text-muted-foreground text-sm tabular-nums">
									{property.occupiedUnits}/{property.totalUnits}
								</span>

								<span className="text-right font-semibold text-sm tabular-nums">
									{formatRupees(property.monthlyRevenue)}
								</span>
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);
}
