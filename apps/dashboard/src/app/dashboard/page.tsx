"use client";

import { IconBuildingSkyscraper, IconFileText } from "@tabler/icons-react";
import { DashboardPageHeader } from "@/components/features/dashboard/dashboard-page-header";
import { OccupancyCard } from "@/components/features/dashboard/occupancy-card";
import { PortfolioHealth } from "@/components/features/dashboard/portfolio-health";
import { QuickActions } from "@/components/features/dashboard/quick-actions";
import { RecentTransactions } from "@/components/features/dashboard/recent-transactions";
import { RevenueChart } from "@/components/features/dashboard/revenue-chart";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { UnitsCard } from "@/components/features/dashboard/unit-card";
import { Container } from "@/components/shared/container";
import { useDashboardStats } from "@/hooks/dashboard";

export default function DashboardPage() {
	const { data, isLoading } = useDashboardStats();

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
				<RevenueChart className="col-span-full lg:col-span-8 lg:row-span-2" />

				{/* ── Sidebar pair ────── */}
				<QuickActions className="col-span-full sm:col-span-1 lg:col-span-4" />
				<PortfolioHealth
					occupiedUnits={data?.occupiedUnits}
					availableUnits={data?.availableUnits}
					activeLeases={data?.activeLeases}
					totalProperties={data?.totalProperties}
					isLoading={isLoading}
					className="col-span-full sm:col-span-1 lg:col-span-4"
				/>

				{/* ── Transactions ──────── */}
				<RecentTransactions className="col-span-full" />
			</main>
		</Container>
	);
}
