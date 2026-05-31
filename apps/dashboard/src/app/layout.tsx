import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";

import "../index.css";
import { SidebarProvider } from "@rently/ui/components/sidebar";
import { Toaster } from "@rently/ui/components/sonner";
import { cn } from "@rently/ui/lib/utils";
import DashboardHeader from "@/components/layouts/dashboard-header";
import { DashbaordSidebar } from "@/components/layouts/dashboard-sidebar";
import { DashboardORPCProvider } from "@/components/providers/orpc-provider";
import { QueryProvider } from "@/components/providers/query-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "RentWise",
	description: "Managing Tenant at your fingertips",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			suppressHydrationWarning
			className={cn("font-sans", inter.variable)}
		>
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				<QueryProvider>
					<DashboardORPCProvider>
						<SidebarProvider>
							<DashbaordSidebar />
							<div className="flex min-h-screen w-full flex-col">
								<DashboardHeader />
								<main className="bg-mist-100 px-6 py-4">{children}</main>
								<Toaster position="bottom-right" />
							</div>
						</SidebarProvider>
					</DashboardORPCProvider>
				</QueryProvider>
			</body>
		</html>
	);
}
