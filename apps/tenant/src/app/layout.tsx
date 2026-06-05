import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";

import "../index.css";
import { Toaster } from "@rently/ui/components/sonner";
import { cn } from "@rently/ui/lib/utils";

import { TenantORPCProvider } from "@/components/providers/orpc-provider";
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
					<TenantORPCProvider>
						<div className="mx-auto flex min-h-screen max-w-4xl flex-col">
							{children}
							<Toaster position="bottom-right" />
						</div>
					</TenantORPCProvider>
				</QueryProvider>
			</body>
		</html>
	);
}
