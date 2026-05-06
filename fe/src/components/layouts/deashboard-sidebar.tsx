"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "@/components/ui/sidebar";
import { NavigationLinks } from "@/constants/navigation";
import Logo from "../shared/logo";

export function AppSidebar() {
	const pathname = usePathname();

	const overviewLinks = NavigationLinks.filter((link) =>
		["dashboard", "properties", "tenants", "payments"].includes(
			link.name.toLowerCase(),
		),
	);

	const systemLinks = NavigationLinks.filter((link) =>
		["settings", "help"].includes(link.name.toLowerCase()),
	);

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg">
							<Logo className="h-6 w-auto" />
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				{/* Overview Section */}
				<SidebarGroup>
					<SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						MENU
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu className="space-y-4">
							{overviewLinks.map((item) => (
								<SidebarMenuItem key={item.name} className="">
									<SidebarMenuButton
										isActive={pathname === item.href}
										tooltip={item.name}
										className=""
									>
										<Link href={item.href} className="flex items-center gap-2">
											<item.icon className="shrink-0 !size-5" />
											<span className="text-base">{item.name}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				{/* System Section */}
				<SidebarGroup>
					<SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						System
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{systemLinks.map((item) => (
								<SidebarMenuItem key={item.name}>
									<SidebarMenuButton
										isActive={pathname === item.href}
										tooltip={item.name}
									>
										<Link href={item.href} className="flex items-center gap-2">
											<item.icon className="!size-5" />
											<span className="text-base">{item.name}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter className="p-3">
				<div className="rounded-md border bg-muted/50 p-3">
					<p className="text-xs text-muted-foreground">Need help?</p>
					<p className="mt-1 text-sm font-medium text-foreground">
						Check documentation
					</p>
				</div>
			</SidebarFooter>

			<SidebarRail />
		</Sidebar>
	);
}
