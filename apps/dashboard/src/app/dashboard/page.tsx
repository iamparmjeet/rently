"use client";

import { IconBuildingSkyscraper, IconFileText } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { DashboardPageHeader } from "@/components/features/dashboard/dashboard-page-header";
import { OccupancyCard } from "@/components/features/dashboard/occupancy-card";
import { OverdueSummaryCard } from "@/components/features/dashboard/overdue-summary-card";
import { RecentProperties } from "@/components/features/dashboard/recent-property";
import { RecentTenants } from "@/components/features/dashboard/recent-tenants";
import { RecentTransactions } from "@/components/features/dashboard/recent-transactions";
import { RevenueChart } from "@/components/features/dashboard/revenue-chart";
import { SampleLoader } from "@/components/features/dashboard/sample-loader";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { UnitsCard } from "@/components/features/dashboard/unit-card";
import { UpcomingDues } from "@/components/features/dashboard/upcoming-dues";
import { Container } from "@/components/shared/container";
import { useDashboardStats, useRevenueDashboard } from "@/hooks/dashboard";
import { orpc } from "@/utils/orpc";

export default function DashboardPage() {
	const { data, isLoading } = useDashboardStats();
	const { data: revenueData, isLoading: revenueLoading } =
		useRevenueDashboard();
	const { data: experience } = useQuery(
		orpc.workspace.getExperience.queryOptions(),
	);

	return (
		<Container>
			<main className="grid w-full grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:gap-6">
				{/* ── Header ──────────── */}
				<DashboardPageHeader className="col-span-full" />
				<SampleLoader
					canLoadSample={experience?.canLoadSample ?? false}
					isEmpty={(data?.totalProperties ?? 0) === 0}
				/>

				{/* ── Stat cards ───────────────── */}
				<StatCard
					icon={IconBuildingSkyscraper}
					value={data?.totalProperties ?? 0}
					label="Total Properties"
					href="/properties"
					isLoading={isLoading}
					className="col-span-full sm:col-span-1 lg:col-span-3"
				/>
				<UnitsCard
					totalUnits={data?.totalUnits ?? 0}
					occupiedUnits={data?.occupiedUnits ?? 0}
					isLoading={isLoading}
					className="col-span-full sm:col-span-1 lg:col-span-3"
				/>
				<OccupancyCard
					occupancyRate={data?.occupancyRate ?? 0}
					occupiedUnits={data?.occupiedUnits ?? 0}
					availableUnits={data?.availableUnits ?? 0}
					isLoading={isLoading}
					className="col-span-full sm:col-span-1 lg:col-span-3"
				/>
				<StatCard
					icon={IconFileText}
					value={data?.activeLeases ?? 0}
					label="Active Leases"
					href="/leases"
					isLoading={isLoading}
					variant="accent"
					className="col-span-full sm:col-span-1 lg:col-span-3"
				/>

				{/* ── Revenue chart ─────── */}
				<RevenueChart
					data={revenueData?.revenueByMonth ?? []}
					isLoading={revenueLoading}
					className="col-span-full lg:col-span-8 lg:row-span-1"
				/>

				{/* ── Sidebar ────── */}
				<UpcomingDues className="col-span-full sm:col-span-1 lg:col-span-4" />

				<OverdueSummaryCard
					overdueCount={revenueData?.overdueCount ?? 0}
					overdueAmount={revenueData?.overdueAmount ?? 0}
					isLoading={revenueLoading}
					className="col-span-full sm:col-span-1 lg:col-span-4"
				/>

				{/* Pair*/}
				<RecentProperties className="col-span-full sm:col-span-1 lg:col-span-8" />
				<RecentTenants className="col-span-full sm:col-span-1 lg:col-span-6" />

				{/* ── Transactions ──────── */}
				<RecentTransactions
					transactions={revenueData?.recentTransactions ?? []}
					isLoading={revenueLoading}
					className="col-span-full lg:col-span-6"
				/>
			</main>
		</Container>
	);
}
