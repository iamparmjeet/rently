"use client";

import { PLAN_STATUS } from "@rently/db/constants/payment-constants";
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
import { NavigationLinks } from "@/constants/navigation";
import { useMySubscription } from "@/hooks/subscriptions";
import { useSession } from "@/lib/auth-client";

export function DashbaordSidebar() {
	const { data: session } = useSession();
	const pathname = usePathname();
	const { data: subscriptionData, isError: subscriptionError } =
		useMySubscription();

	const isDemo = session?.user.accountMode === "public_demo";
	const isSubscriptionActive =
		subscriptionData?.subscription?.status === PLAN_STATUS.ACTIVE;

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
										<Link
											href={item.href}
											className="flex w-full items-center gap-2"
										>
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
										<Link
											href={item.href}
											className="flex w-full items-center gap-2"
										>
											<item.icon className="`!size-5`" />
											<span className="text-base">{item.name}</span>
											{item.name === "Subscription" && subscriptionData && (
												<span className="ml-auto flex shrink-0 items-center gap-1.5 font-medium text-[11px] text-muted-foreground group-data-[collapsible=icon]:hidden">
													<span
														aria-hidden="true"
														className={`size-1.5 rounded-full shadow-[0_0_0_2px] ${
															isSubscriptionActive
																? "bg-emerald-500 shadow-emerald-500/15"
																: "bg-amber-500 shadow-amber-500/15"
														}`}
													/>
													{subscriptionData.subscription?.plan.name ??
														"Starter"}
												</span>
											)}
											{item.name === "Subscription" && subscriptionError && (
												<span className="ml-auto shrink-0 text-[11px] text-muted-foreground group-data-[collapsible=icon]:hidden">
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
