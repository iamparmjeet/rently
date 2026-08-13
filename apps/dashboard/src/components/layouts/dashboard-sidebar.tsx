"use client";

import { Separator } from "@rently/ui/components/separator";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "@rently/ui/components/sidebar";
import Logo from "@rently/ui/shared/logo";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SubscriptionStatus } from "@/components/features/subscriptions/subscription-status";
import { NavigationLinks } from "@/constants/navigation";
import { useMySubscription } from "@/hooks/subscriptions";
import { useSession } from "@/lib/auth-client";

export function DashbaordSidebar() {
	const { data: session } = useSession();
	const pathname = usePathname();
	const { data: subscriptionData, isError: subscriptionError } =
		useMySubscription();

	const isDemo = session?.user.accountMode === "public_demo";

	const overviewLinks = NavigationLinks.filter((link) =>
		[
			"dashboard",
			"properties",
			"units",
			"tenants",
			"leases",
			"payments",
			"utilities",
		].includes(link.name.toLowerCase()),
	);

	const systemLinks = NavigationLinks.filter((link) =>
		["settings", "subscription", "help"].includes(link.name.toLowerCase()),
	);

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader className="p-0">
				<SidebarMenu>
					<SidebarMenuItem className="w-full">
						<SidebarContent className="flex flex-row items-center justify-between">
							<Logo className="p-4" demo={isDemo} />
						</SidebarContent>
						<Separator className="my-4 w-full" />
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
						<SidebarMenu>
							{overviewLinks.map((item) => (
								<SidebarMenuItem key={item.name} className="">
									<SidebarMenuButton
										isActive={
											pathname === item.href ||
											pathname.startsWith(`${item.href}/`)
										}
										tooltip={item.name}
									>
										<Link href={item.href} className="flex items-center gap-2">
											<item.icon className="size-4.5! shrink-0" />
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
										isActive={
											pathname === item.href ||
											pathname.startsWith(`${item.href}/`)
										}
										tooltip={item.name}
									>
										<Link href={item.href} className="flex items-center gap-2">
											<item.icon className="`!size-5`" />
											<span className="text-base">{item.name}</span>
											{item.name === "Subscription" && subscriptionData && (
												<SubscriptionStatus
													subscription={subscriptionData.subscription}
													showPlan
													className="ml-auto shrink-0 group-data-[collapsible=icon]:hidden"
												/>
											)}
											{item.name === "Subscription" && subscriptionError && (
												<span className="ml-auto shrink-0 rounded-md border px-2 py-1 text-[10px] text-muted-foreground group-data-[collapsible=icon]:hidden">
													Unavailable
												</span>
											)}
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarRail />
		</Sidebar>
	);
}
