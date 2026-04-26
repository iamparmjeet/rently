// src/app/(dashboard)/layout.tsx
"use client";

import { IconMenu2 } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import DashboardHeader from "@/components/layouts/dashboard-header";
import DashboardSidebar from "@/components/layouts/deashboard-sidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useSession } from "@/lib/auth-client";

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { data: session, isPending } = useSession();
	const router = useRouter();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (mounted && !isPending && !session) {
			router.push("/login");
		}
	}, [mounted, isPending, session, router]);

	if (!mounted || isPending) {
		return (
			<div className="flex h-screen items-center justify-center">
				<div className="text-center space-y-4">
					<div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
					<p className="text-muted-foreground">Loading...</p>
				</div>
			</div>
		);
	}

	if (!session) {
		return null;
	}

	return (
		<div className="flex h-screen overflow-hidden bg-linear-to-br from-zinc-50 to-zinc-100">
			{/* Desktop Sidebar - Bento Style */}
			<DashboardSidebar />
			{/* Main Content Area */}
			<div className="flex flex-col flex-1 overflow-hidden">
				<DashboardHeader />

				{/* Bento Grid Content */}
				<main className="flex-1 overflow-y-auto p-6">
					<div className="grid grid-cols-12 gap-4 auto-rows-[minmax(180px,auto)]">
						{children}
					</div>
				</main>
			</div>

			{/* Mobile Sheet Trigger (for header) */}
			<div className="fixed bottom-6 right-6 z-50 lg:hidden">
				<Sheet>
					<SheetTrigger asChild>
						<button className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:scale-105">
							<IconMenu2 className="h-6 w-6" />
						</button>
					</SheetTrigger>
					<SheetContent side="left" className="w-72 p-0">
						<DashboardSidebar />
					</SheetContent>
				</Sheet>
			</div>
		</div>
	);
}
