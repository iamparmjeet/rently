// src/components/layouts/dashboard-sidebar.tsx
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavigationLinks } from "@/constants/navigation";
import Logo from "../shared/logo";

interface DashboardSidebarProps {
	mobile?: boolean;
}

export default function DashboardSidebar({ mobile }: DashboardSidebarProps) {
	const pathname = usePathname();
	const r = "calc(var(--radius)*1.8)"; // Large radius for bento feel

	const navItem = (active: boolean) =>
		`flex items-center gap-3 rounded-[${r}] px-4 py-3 text-sm font-medium transition-all ${
			active
				? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
				: "text-muted-foreground hover:bg-muted hover:text-foreground"
		}`;

	const sidebarContent = (
		<div className="flex h-full flex-col p-4 bg-sidebar border-r border-sidebar-border">
			<Logo className="px-3 pb-4" />

			{/* Main Navigation */}
			<nav className="space-y-2">
				<span className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					Overview
				</span>
				{NavigationLinks.filter((link) =>
					["dashboard", "properties", "tenants", "payments"].includes(
						link.name.toLowerCase(),
					),
				).map((item) => (
					<Link
						key={item.name}
						href={item.href}
						className={navItem(pathname === item.href)}
					>
						<item.icon className="h-5 w-5" />
						{item.name}
					</Link>
				))}
			</nav>

			{/* Settings Navigation */}
			<nav className="mt-6 space-y-2">
				<span className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					System
				</span>
				{NavigationLinks.filter((link) =>
					["settings", "help"].includes(link.name.toLowerCase()),
				).map((item) => (
					<Link
						key={item.name}
						href={item.href}
						className={navItem(pathname === item.href)}
					>
						<item.icon className="h-5 w-5" />
						{item.name}
					</Link>
				))}
			</nav>

			{/* Footer */}
			<div className="mt-auto rounded-[${r}] border border-border bg-muted/50 p-4">
				<p className="text-xs text-muted-foreground">Need help?</p>
				<p className="mt-1 text-sm font-medium text-foreground">
					Check documentation
				</p>
			</div>
		</div>
	);

	return (
		<aside className={`hidden lg:block ${mobile ? "lg:block" : ""}`}>
			{mobile ? <div className="h-full">{sidebarContent}</div> : sidebarContent}
		</aside>
	);
}
