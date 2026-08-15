import { Skeleton } from "@rently/ui/components/skeleton";
import { formatRupees } from "@rently/ui/lib/currency";
import { IconAlertTriangle, IconArrowUpRight } from "@tabler/icons-react";
import Link from "next/link";

interface OverdueSummaryCardProps {
	overdueCount: number;
	overdueAmount: number;
	isLoading: boolean;
	className?: string;
}

export function OverdueSummaryCard({
	overdueCount,
	overdueAmount,
	isLoading,
	className = "",
}: OverdueSummaryCardProps) {
	return (
		<div
			className={`overflow-hidden rounded-xl border border-destructive/20 bg-card shadow-sm ${className}`}
		>
			<div className="border-b bg-gradient-to-br from-destructive/[0.12] via-destructive/[0.03] to-transparent px-5 pt-5 pb-4">
				<div className="flex items-start justify-between gap-3">
					<div className="flex items-start gap-3">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive text-destructive-foreground shadow-destructive/20 shadow-lg">
							<IconAlertTriangle className="size-5" />
						</div>
						<div>
							<p className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
								Collections risk
							</p>
							<h3 className="mt-0.5 font-semibold text-sm">Overdue rent</h3>
						</div>
					</div>
					<Link
						href="/tenants"
						className="flex items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground"
					>
						View tenants
						<IconArrowUpRight className="size-3" />
					</Link>
				</div>
			</div>

			<div className="px-5 py-4">
				{isLoading ? (
					<Skeleton className="h-8 w-24" />
				) : (
					<>
						<p className="font-semibold text-3xl tabular-nums tracking-tight">
							{overdueCount}
						</p>
						<p className="mt-2 text-muted-foreground text-xs">
							{overdueCount === 0
								? "All active leases are up to date"
								: `${formatRupees(overdueAmount)} outstanding across ${overdueCount} lease${overdueCount === 1 ? "" : "s"}`}
						</p>
					</>
				)}
			</div>
		</div>
	);
}
