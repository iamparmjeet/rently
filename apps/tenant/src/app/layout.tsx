import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";

import "../index.css";
import { Toaster } from "@rently/ui/components/sonner";
import { cn } from "@rently/ui/lib/utils";

import { TenantORPCProvider } from "@/components/providers/orpc-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { WorkspaceExperienceProvider } from "@/components/providers/workspace-experience-provider";

const inter = Inter({
	subsets: ["latin"],
	variable: "--font-sans",
	display: "swap",
	preload: false,
});

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
	display: "swap",
	preload: false,
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
	display: "swap",
	preload: false,
});

export const metadata: Metadata = {
	title: "KeyHQ",
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
					<TenantORPCProvider>
						<WorkspaceExperienceProvider>
							<div className="mx-auto flex min-h-screen max-w-4xl flex-col">
								{children}
								<Toaster position="bottom-right" />
							</div>
						</WorkspaceExperienceProvider>
					</TenantORPCProvider>
				</QueryProvider>
			</body>
		</html>
	);
}
