// src/app/(dashboard)/layout.tsx
import { SidebarInset, SidebarProvider } from "@rently/ui/components/sidebar";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import DashboardHeader from "@/components/layouts/dashboard-header";
import { AppSidebar } from "@/components/layouts/deashboard-sidebar";
import { orpc } from "@/utils/orpc";
import { getQueryClient } from "@/utils/query-client";

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const queryClient = getQueryClient();

	await queryClient.prefetchQuery(
		orpc.rent.property.listProperties.queryOptions(),
	);

	const dehydratedState = dehydrate(queryClient);
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<DashboardHeader />
				<main className="flex-1 overflow-y-auto bg-slate-100 p-6">
					<div className="grid auto-rows-[minmax(180px,auto)] grid-cols-12 gap-4">
						<HydrationBoundary state={dehydratedState}>
							{children}
						</HydrationBoundary>
					</div>
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
