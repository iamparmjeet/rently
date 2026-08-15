import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../index.css";
import { SidebarProvider } from "@rently/ui/components/sidebar";
import { Toaster } from "@rently/ui/components/sonner";
import { AdminHeader } from "@/components/layouts/admin-header";
import { AdminSidebar } from "@/components/layouts/admin-sidebar";
import { QueryProvider } from "@/components/providers/query-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
	title: "KeyHQ Admin",
	description: "Private KeyHQ operations console",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" className={inter.variable}>
			<body>
				<QueryProvider>
					<SidebarProvider>
						<AdminSidebar />
						<div className="flex min-h-screen w-full flex-col bg-muted/30">
							<AdminHeader />
							{children}
						</div>
					</SidebarProvider>
					<Toaster position="bottom-right" />
				</QueryProvider>
			</body>
		</html>
	);
}
