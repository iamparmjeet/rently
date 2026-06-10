"use client";

import { IconBuildingSkyscraper, IconFileText } from "@tabler/icons-react";
import { DashboardPageHeader } from "@/components/features/dashboard/dashboard-page-header";
import { OccupancyCard } from "@/components/features/dashboard/occupancy-card";
import { RecentProperties } from "@/components/features/dashboard/recent-property";
import { RecentTenants } from "@/components/features/dashboard/recent-tenants";
import { RecentTransactions } from "@/components/features/dashboard/recent-transactions";
import { RevenueChart } from "@/components/features/dashboard/revenue-chart";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { UnitsCard } from "@/components/features/dashboard/unit-card";
import { UpcomingDues } from "@/components/features/dashboard/upcoming-dues";
import { Container } from "@/components/shared/container";
import { useDashboardStats, useRevenueDashboard } from "@/hooks/dashboard";

export default function DashboardPage() {
	const { data, isLoading } = useDashboardStats();
	const { data: revenueData, isLoading: revenueLoading } =
		useRevenueDashboard();

	return (
		<Container>
			<main className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:gap-6">
				{/* ── Header ──────────── */}
				<DashboardPageHeader className="col-span-full" />

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

				{/* Pair*/}
				<RecentProperties className="col-span-full sm:col-span-1 lg:col-span-6 lg:row-span-10" />
				<RecentTenants className="col-span-full sm:col-span-1 lg:col-span-6 lg:row-span-10" />

				{/* ── Transactions ──────── */}
				<RecentTransactions
					transactions={revenueData?.recentTransactions ?? []}
					isLoading={revenueLoading}
					className="col-span-full"
				/>
			</main>
		</Container>
	);
}
