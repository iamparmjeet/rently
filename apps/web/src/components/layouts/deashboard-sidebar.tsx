"use client";

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
} from "@rently/ui/components/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
					<SidebarGroupLabel className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
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
											<item.icon className="!size-5 shrink-0" />
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
					<SidebarGroupLabel className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
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
					<p className="text-muted-foreground text-xs">Need help?</p>
					<p className="mt-1 font-medium text-foreground text-sm">
						Check documentation
					</p>
				</div>
			</SidebarFooter>

			<SidebarRail />
		</Sidebar>
	);
}
