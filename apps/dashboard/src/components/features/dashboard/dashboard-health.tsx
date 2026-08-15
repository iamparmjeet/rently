import { formatRupees } from "@rently/ui/lib/currency";
import {
	IconBuilding,
	IconChartBar,
	IconFileText,
	IconLayoutBoard,
} from "@tabler/icons-react";

interface DashboardHealthProps {
	occupancyRate: number;
	occupiedUnits: number;
	availableUnits: number;
	totalProperties: number;
	totalUnits: number;
	activeLeases: number;
	monthlyRevenue: number;
	isLoading: boolean;
	revenueLoading: boolean;
}

export function DashboardHealth({
	occupancyRate,
	occupiedUnits,
	availableUnits,
	totalProperties,
	totalUnits,
	activeLeases,
	monthlyRevenue,
	isLoading,
	revenueLoading,
}: DashboardHealthProps) {
	return (
		<section className="overflow-hidden rounded-xl border bg-card shadow-sm">
			<div className="grid divide-y sm:grid-cols-[1.05fr_1fr] sm:divide-x sm:divide-y-0">
				<div className="relative overflow-hidden bg-gradient-to-br from-primary/[0.08] via-card to-card p-5">
					<div className="absolute -top-10 -right-10 size-32 rounded-full bg-primary/[0.08] blur-2xl" />
					<div className="relative">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.14em]">
							Portfolio health
						</p>
						{isLoading ? (
							<div className="mt-2 h-9 w-24 animate-pulse rounded bg-muted" />
						) : (
							<p className="mt-1 font-semibold text-3xl tracking-tight">
								{occupancyRate}%{" "}
								<span className="font-normal text-base text-muted-foreground">
									occupied
								</span>
							</p>
						)}
						<div className="mt-4 h-1.5 max-w-sm overflow-hidden rounded-full bg-primary/10">
							<div
								className="h-full rounded-full bg-primary transition-all"
								style={{ width: `${occupancyRate}%` }}
							/>
						</div>
						<p className="mt-2 text-muted-foreground text-xs">
							{occupiedUnits} occupied · {availableUnits} available
						</p>
					</div>
				</div>
				<div className="grid grid-cols-2 divide-x sm:grid-cols-4">
					<HealthMetric
						icon={IconBuilding}
						label="Properties"
						value={totalProperties}
						isLoading={isLoading}
					/>
					<HealthMetric
						icon={IconLayoutBoard}
						label="Units"
						value={totalUnits}
						isLoading={isLoading}
					/>
					<HealthMetric
						icon={IconFileText}
						label="Active leases"
						value={activeLeases}
						isLoading={isLoading}
					/>
					<HealthMetric
						icon={IconChartBar}
						label="This month"
						value={formatRupees(monthlyRevenue)}
						isLoading={revenueLoading}
					/>
				</div>
			</div>
		</section>
	);
}

function HealthMetric({
	icon: Icon,
	label,
	value,
	isLoading,
}: {
	icon: typeof IconBuilding;
	label: string;
	value: string | number;
	isLoading: boolean;
}) {
	return (
		<div className="min-w-0 px-3 py-5 text-center sm:px-4">
			<Icon className="mx-auto size-4 text-primary" />
			<p className="mt-2 truncate text-muted-foreground text-xs">{label}</p>
			{isLoading ? (
				<div className="mx-auto mt-1 h-5 w-12 animate-pulse rounded bg-muted" />
			) : (
				<p className="mt-1 truncate font-semibold text-sm sm:text-base">
					{value}
				</p>
			)}
		</div>
	);
}
