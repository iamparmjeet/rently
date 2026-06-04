// Static decorative data — order never changes
const CHART_HEIGHTS = [38, 55, 44, 72, 50, 65, 58, 88, 45, 70, 82, 92];
const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

interface RevenueChartProps {
	className?: string;
}

export function RevenueChart({ className = "" }: RevenueChartProps) {
	return (
		<div
			className={`min-h-85 rounded-2xl border border-border/40 bg-card p-6 shadow-sm ${className}`}
		>
			<div className="flex items-start justify-between">
				<div>
					<h2 className="font-semibold text-base">Revenue Overview</h2>
					<p className="mt-0.5 text-muted-foreground text-sm">
						Monthly rent collection across all properties
					</p>
				</div>
				<span className="rounded-lg bg-muted/60 px-3 py-1.5 text-muted-foreground text-xs">
					Coming soon
				</span>
			</div>

			<div
				className="mt-6 flex items-end gap-1.5"
				style={{ height: "calc(100% - 7rem)" }}
			>
				{CHART_HEIGHTS.map((h, i) => (
					<div key={i} className="group flex flex-1 flex-col">
						<div
							className="w-full rounded-t-md border-primary/25 border-t-2 bg-primary/8 transition-colors duration-300 group-hover:border-primary/50 group-hover:bg-primary/15"
							style={{ height: `${h}%` }}
						/>
					</div>
				))}
			</div>

			<div className="mt-2 flex gap-1.5">
				{MONTHS.map((m) => (
					<p
						key={m}
						className="flex-1 text-center text-[11px] text-muted-foreground"
					>
						{m}
					</p>
				))}
			</div>
		</div>
	);
}
