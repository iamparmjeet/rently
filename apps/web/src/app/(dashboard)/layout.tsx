// src/app/(dashboard)/layout.tsx

import { SidebarInset, SidebarProvider } from "@rently/ui/components/sidebar";
import DashboardHeader from "@/components/layouts/dashboard-header";
import { AppSidebar } from "@/components/layouts/deashboard-sidebar";
import { QueryProvider } from "@/components/providers/query-provider";

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
					<main className="flex-1 overflow-y-auto bg-slate-100 p-6">
						<div className="grid auto-rows-[minmax(180px,auto)] grid-cols-12 gap-4">
							{children}
						</div>
					</main>
				</SidebarInset>
			</SidebarProvider>
		</QueryProvider>
	);
}
