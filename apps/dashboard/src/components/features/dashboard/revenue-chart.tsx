import { Skeleton } from "@rently/ui/components/skeleton";
import { formatRupees } from "@rently/ui/lib/currency";
import { format } from "date-fns";

interface RevenueMonth {
	monthStart: Date;
	total: number;
}

interface RevenueChartProps {
	data: RevenueMonth[];
	isLoading?: boolean;
	className?: string;
}

const MIN_BAR_PCT = 4;

function barHeight(total: number, maxTotal: number): number {
	if (maxTotal === 0) return MIN_BAR_PCT;
	return Math.max(MIN_BAR_PCT, Math.round((total / maxTotal) * 100));
}

export function RevenueChart({
	data,
	isLoading,
	className = "",
}: RevenueChartProps) {
	const maxTotal = Math.max(...data.map((d) => d.total), 0);
	const totalYTD = data.reduce((sum, d) => sum + d.total, 0);
	const hasData = totalYTD > 0;
	const currentMonthIdx = data.length - 1;

	return (
		<div
			className={`overflow-hidden rounded-xl border bg-card shadow-sm ${className}`}
		>
			<div className="border-b bg-gradient-to-br from-primary/[0.10] via-primary/[0.025] to-transparent px-5 pt-5 pb-4">
				<div className="flex items-start justify-between gap-3">
					<div>
						<p className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
							Collections
						</p>
						<h2 className="mt-0.5 font-semibold text-base">Revenue overview</h2>
						<p className="mt-1 text-muted-foreground text-xs">
							Monthly rent collection across all properties
						</p>
					</div>
					{isLoading ? (
						<Skeleton className="h-6 w-24 rounded-lg" />
					) : hasData ? (
						<div className="text-right">
							<p className="font-semibold text-sm tabular-nums">
								{formatRupees(totalYTD)}
							</p>
							<p className="text-muted-foreground text-xs">Last 12 months</p>
						</div>
					) : (
						<span className="rounded-lg bg-muted/60 px-3 py-1.5 text-muted-foreground text-xs">
							No data yet
						</span>
					)}
				</div>
			</div>

			<div className="px-5 py-4">
				{isLoading ? (
					<ChartLoading />
				) : !hasData ? (
					<NoData />
				) : (
					<>
						<div className="flex items-end gap-1.5" style={{ height: "11rem" }}>
							{data.map((month, i) => {
								const isCurrentMonth = i === currentMonthIdx;
								const h = barHeight(month.total, maxTotal);

								return (
									<div
										key={month.monthStart.toISOString()}
										className="group relative flex-1"
										style={{ height: `${h}%` }}
									>
										{month.total > 0 && (
											<div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[10px] text-background opacity-0 transition-opacity group-hover:opacity-100">
												{formatRupees(month.total)}
											</div>
										)}
										<div
											className={`h-full w-full rounded-t-md border-t-2 transition-colors duration-200 ${
												isCurrentMonth
													? "border-primary bg-primary/20 group-hover:bg-primary/30"
													: "border-primary/25 bg-primary/8 group-hover:border-primary/50 group-hover:bg-primary/15"
											}`}
										/>
									</div>
								);
							})}
						</div>

						<div className="mt-1.5 flex gap-1.5">
							{data.map((month, i) => (
								<p
									key={month.monthStart.toISOString()}
									className={`flex-1 text-center text-[11px] ${
										i === currentMonthIdx
											? "font-semibold text-foreground"
											: "text-muted-foreground"
									}`}
								>
									{format(month.monthStart, "MMM")}
								</p>
							))}
						</div>
					</>
				)}
			</div>
		</div>
	);
}

function NoData() {
	return (
		<div className="flex h-40 flex-col items-center justify-center text-center">
			<p className="font-medium text-muted-foreground text-sm">
				No payments recorded yet
			</p>
			<p className="mt-1 text-muted-foreground text-xs">
				Revenue will appear here once you start recording payments.
			</p>
		</div>
	);
}

function ChartLoading() {
	return (
		<div className="flex h-44 items-end gap-1.5">
			{Array.from({ length: 12 }).map((_, i) => (
				<div key={i} className="flex flex-1 flex-col">
					<div
						className="w-full animate-pulse rounded-t-md bg-muted"
						style={{
							height: `${[38, 55, 44, 72, 50, 65, 58, 88, 45, 70, 82, 92][i]}%`,
							animationDelay: `${i * 40}ms`,
						}}
					/>
				</div>
			))}
		</div>
	);
}
