"use client";

import { useQuery } from "@tanstack/react-query";
import { DashboardHealth } from "@/components/features/dashboard/dashboard-health";
import { DashboardPageHeader } from "@/components/features/dashboard/dashboard-page-header";
import { OverdueSummaryCard } from "@/components/features/dashboard/overdue-summary-card";
import { RecentProperties } from "@/components/features/dashboard/recent-property";
import { RecentTenants } from "@/components/features/dashboard/recent-tenants";
import { RecentTransactions } from "@/components/features/dashboard/recent-transactions";
import { RevenueChart } from "@/components/features/dashboard/revenue-chart";
import { SampleLoader } from "@/components/features/dashboard/sample-loader";
import { UpcomingDues } from "@/components/features/dashboard/upcoming-dues";
import { Container } from "@/components/shared/container";
import { usePeriodBalance } from "@/hooks/balance/use-period-balance";
import { useDashboardStats, useRevenueDashboard } from "@/hooks/dashboard";
import { countOverdueLeases, sumOverdueRent } from "@/lib/upcoming-dues";
import { orpc } from "@/utils/orpc";

export default function DashboardPage() {
	const { data, isLoading } = useDashboardStats();
	const { data: revenueData, isLoading: revenueLoading } =
		useRevenueDashboard();
	// C06: the overdue card reads the period balance model (arrears per
	// charge), not the lifetime overdue snapshot in the revenue stats.
	// Same query as UpcomingDues — TanStack dedupes by key.
	const { data: balanceData, isLoading: balanceLoading } = usePeriodBalance({
		all: true,
	});
	const overdueCount = countOverdueLeases(balanceData?.leases);
	const overdueAmount = sumOverdueRent(balanceData?.leases);
	const { data: experience } = useQuery(
		orpc.workspace.getExperience.queryOptions(),
	);

	return (
		<Container>
			<div className="col-span-12 flex flex-col gap-6">
				<DashboardPageHeader />
				<SampleLoader
					canLoadSample={experience?.canLoadSample ?? false}
					isEmpty={(data?.totalProperties ?? 0) === 0}
				/>

				<DashboardHealth
					occupancyRate={data?.occupancyRate ?? 0}
					occupiedUnits={data?.occupiedUnits ?? 0}
					availableUnits={data?.availableUnits ?? 0}
					totalProperties={data?.totalProperties ?? 0}
					totalUnits={data?.totalUnits ?? 0}
					activeLeases={data?.activeLeases ?? 0}
					monthlyRevenue={revenueData?.totalThisMonth ?? 0}
					isLoading={isLoading}
					revenueLoading={revenueLoading}
				/>

				<div className="grid gap-4 lg:grid-cols-12">
					<RevenueChart
						data={revenueData?.revenueByMonth ?? []}
						isLoading={revenueLoading}
						className="lg:col-span-8"
					/>
					<UpcomingDues className="lg:col-span-4" />
				</div>

				<div className="grid gap-4 lg:grid-cols-12">
					<RecentProperties className="lg:col-span-8" />
					<OverdueSummaryCard
						overdueCount={overdueCount}
						overdueAmount={overdueAmount}
						isLoading={balanceLoading}
						className="lg:col-span-4"
					/>
				</div>

				<div className="grid gap-4 lg:grid-cols-2">
					<RecentTenants />
					<RecentTransactions
						transactions={revenueData?.recentTransactions ?? []}
						isLoading={revenueLoading}
					/>
				</div>
			</div>
		</Container>
	);
}
