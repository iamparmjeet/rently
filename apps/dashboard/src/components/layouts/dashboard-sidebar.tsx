"use client";

import { PLAN_STATUS } from "@rently/db/constants/payment-constants";
import { Separator } from "@rently/ui/components/separator";
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
import Logo from "@rently/ui/shared/logo";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NavigationLinks } from "@/constants/navigation";
import { useMySubscription } from "@/hooks/subscriptions";
import { useSession } from "@/lib/auth-client";

export function DashbaordSidebar() {
	const { data: session } = useSession();
	const pathname = usePathname();
	const [hasMounted, setHasMounted] = useState(false);
	const { data: subscriptionData, isError: subscriptionError } =
		useMySubscription();

	const isDemo = session?.user.accountMode === "public_demo";
	const isSubscriptionActive =
		subscriptionData?.subscription?.status === PLAN_STATUS.ACTIVE;

	useEffect(() => {
		setHasMounted(true);
	}, []);

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
		<Sidebar collapsible="icon" className="bg-sidebar/95 backdrop-blur-xl">
			<SidebarHeader className="p-0">
				<SidebarMenu>
					<SidebarMenuItem className="w-full">
						<SidebarContent className="flex flex-row items-center justify-between px-3 pt-3">
							<Logo
								className="rounded-lg px-2 py-2"
								demo={hasMounted && isDemo}
							/>
						</SidebarContent>
						<Separator className="my-3 w-full" />
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent className="px-2">
				{/* Overview Section */}
				<SidebarGroup>
					<SidebarGroupLabel className="px-2 font-semibold text-[10px] text-muted-foreground/70 uppercase tracking-[0.16em]">
						Workspace
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{overviewLinks.map((item) => (
								<SidebarMenuItem key={item.name}>
									<SidebarMenuButton
										render={
											<Link
												href={item.href}
												className="flex w-full items-center gap-2"
											/>
										}
										isActive={
											pathname === item.href ||
											pathname.startsWith(`${item.href}/`)
										}
										tooltip={item.name}
										className="h-9 rounded-lg px-2.5 text-sm data-active:bg-primary data-active:text-primary-foreground data-active:shadow-sm data-active:hover:bg-primary data-active:hover:text-primary-foreground"
									>
										<item.icon className="size-4 shrink-0" />
										<span className="text-sm">{item.name}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				{/* System Section */}
				<SidebarGroup>
					<SidebarGroupLabel className="mt-3 px-2 font-semibold text-[10px] text-muted-foreground/70 uppercase tracking-[0.16em]">
						System
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{systemLinks.map((item) => {
								const isRouteActive =
									pathname === item.href ||
									pathname.startsWith(`${item.href}/`);
								const isSubscription = item.name === "Subscription";

								return (
									<SidebarMenuItem key={item.name}>
										<SidebarMenuButton
											render={
												<Link
													href={item.href}
													className="flex w-full items-center gap-2"
												/>
											}
											isActive={isRouteActive}
											tooltip={item.name}
											className={
												isSubscription && isRouteActive
													? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
													: "h-9 rounded-lg px-2.5 text-sm"
											}
										>
											<item.icon className="size-5" />
											<span className="text-base">{item.name}</span>
											{isSubscription && subscriptionData && (
												<span
													className={`ml-auto flex shrink-0 items-center gap-1.5 font-medium text-[11px] group-data-[collapsible=icon]:hidden ${
														isRouteActive
															? "text-slate-200/75"
															: "text-muted-foreground"
													}`}
												>
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
											{isSubscription && subscriptionError && (
												<span
													className={`ml-auto shrink-0 text-[11px] group-data-[collapsible=icon]:hidden ${
														isRouteActive
															? "text-slate-200/75"
															: "text-muted-foreground"
													}`}
												>
													Unavailable
												</span>
											)}
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter className="border-t p-2 group-data-[collapsible=icon]:p-1">
				<div className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-2 text-xs group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-1">
					<span
						aria-hidden="true"
						className="size-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_3px] shadow-emerald-500/15"
					/>
					<span className="truncate text-muted-foreground group-data-[collapsible=icon]:hidden">
						Workspace active
					</span>
				</div>
			</SidebarFooter>

			<SidebarRail />
		</Sidebar>
	);
}
