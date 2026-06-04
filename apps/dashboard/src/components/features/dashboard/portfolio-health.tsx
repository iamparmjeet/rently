interface PortfolioHealthProps {
	occupiedUnits: number | undefined;
	availableUnits: number | undefined;
	activeLeases: number | undefined;
	totalProperties: number | undefined;
	isLoading: boolean;
	className?: string;
}

function Skeleton({ className }: { className?: string }) {
	return (
		<div className={`animate-pulse rounded-lg bg-muted ${className ?? ""}`} />
	);
}

export function PortfolioHealth({
	occupiedUnits,
	availableUnits,
	activeLeases,
	totalProperties,
	isLoading,
	className = "",
}: PortfolioHealthProps) {
	const metrics = [
		{
			label: "Occupied units",
			value: occupiedUnits,
			dotClass: "bg-emerald-500",
		},
		{ label: "Vacant units", value: availableUnits, dotClass: "bg-amber-500" },
		{ label: "Active leases", value: activeLeases, dotClass: "bg-primary" },
		{ label: "Properties", value: totalProperties, dotClass: "bg-blue-500" },
	];

	return (
		<div
			className={`rounded-2xl border border-border/40 bg-card p-6 shadow-sm ${className}`}
		>
			<h3 className="font-semibold text-sm">Portfolio Health</h3>

			<div className="mt-4 flex flex-col gap-2">
				{metrics.map(({ label, value, dotClass }) => (
					<div
						key={label}
						className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2.5"
					>
						<div className="flex items-center gap-2.5">
							<div className={`size-2 shrink-0 rounded-full ${dotClass}`} />
							<span className="text-sm">{label}</span>
						</div>
						{isLoading ? (
							<Skeleton className="h-4 w-8" />
						) : (
							<span className="font-semibold text-sm tabular-nums">
								{value ?? 0}
							</span>
						)}
					</div>
				))}
			</div>
		</div>
	);
}
