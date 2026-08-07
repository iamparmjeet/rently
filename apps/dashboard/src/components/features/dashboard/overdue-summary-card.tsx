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
			className={[
				"rounded-2xl border border-destructive/25 bg-destructive/5 p-6 shadow-sm",
				className,
			].join(" ")}
		>
			<div className="flex items-start justify-between">
				<div className="rounded-xl bg-destructive/10 p-2.5">
					<IconAlertTriangle className="size-5 text-destructive" />
				</div>
				<Link
					href="/tenants"
					className="flex items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground"
				>
					View tenants
					<IconArrowUpRight className="size-3" />
				</Link>
			</div>

			<div className="mt-5">
				<p className="font-medium text-muted-foreground text-sm">
					Overdue rent
				</p>
				{isLoading ? (
					<Skeleton className="mt-2 h-8 w-24" />
				) : (
					<>
						<p className="mt-1 font-extrabold text-2xl tabular-nums">
							{overdueCount}
						</p>
						<p className="mt-1 text-muted-foreground text-xs">
							{overdueCount === 0
								? "All active leases are up to date"
								: formatRupees(overdueAmount) +
									" outstanding across " +
									overdueCount +
									" lease" +
									(overdueCount === 1 ? "" : "s")}
						</p>
					</>
				)}
			</div>
		</div>
	);
}
