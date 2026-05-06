// src/app/(dashboard)/layout.tsx
import DashboardHeader from "@/components/layouts/dashboard-header";
import { AppSidebar } from "@/components/layouts/deashboard-sidebar";
import { QueryProvider } from "@/components/providers/query-provider";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<QueryProvider>
			<SidebarProvider>
				<AppSidebar />
				<SidebarInset>
					<DashboardHeader />
					<main className="flex-1 overflow-y-auto p-6 bg-slate-100">
						<div className="grid grid-cols-12 gap-4 auto-rows-[minmax(180px,auto)]">
							{children}
						</div>
					</main>
				</SidebarInset>
			</SidebarProvider>
		</QueryProvider>
	);
}
