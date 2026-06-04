import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";

import "../index.css";
import { Toaster } from "@rently/ui/components/sonner";
import { cn } from "@rently/ui/lib/utils";
import { Footer } from "@/components/layouts/footer";
import { Header } from "@/components/layouts/header";
import { WebORPCProvider } from "@/components/providers/orpc-provider";
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
					<WebORPCProvider>
						<Header />
						<div className="flex min-h-screen flex-col">
							{children}
							<Toaster position="bottom-right" />
						</div>
						<Footer />
					</WebORPCProvider>
				</QueryProvider>
			</body>
		</html>
	);
}
