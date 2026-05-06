"use client";

import { IconBell, IconLogout, IconSearch } from "@tabler/icons-react";
import Image from "next/image";
import Link from "next/link";
import { useLogout } from "@/hooks/auth";
import { useSession } from "@/lib/auth-client";
import { Button } from "../ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "../ui/sheet";
import { SidebarTrigger, useSidebar } from "../ui/sidebar";
import { AppSidebar } from "./deashboard-sidebar";

export default function DashboardHeader() {
	return (
		<header className="flex h-20 items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-xl px-6">
			{/* Mobile Menu Trigger */}
			<div className="flex items-center gap-4">
				<MobileMenuTrigger />
				<SidebarTrigger size="lg" className="-ml-2" />
				{/* Desktop Search */}
				<div className="hidden lg:block group relative">
					<div className="flex h-12 items-center rounded-[calc(var(--radius)*1.8)] border border-input bg-muted/50 px-4 transition-all focus-within:border-primary focus-within:bg-background focus-within:shadow-lg focus-within:shadow-primary/10">
						<IconSearch className="h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
						<input
							type="search"
							placeholder="Search properties, tenants..."
							className="ml-3 w-64 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
						/>
						<kbd className="ml-auto hidden rounded-[calc(var(--radius)*0.8)] border border-border bg-muted px-2 py-1 text-xs text-muted-foreground sm:block">
							⌘K
						</kbd>
					</div>
				</div>
			</div>

			{/* Right Actions */}
			<div className="flex items-center gap-3">
				<NotificationButton />
				<UserButton />
			</div>
		</header>
	);
}

function MobileMenuTrigger() {
	const { isMobile } = useSidebar();

	if (!isMobile) return null;

	return (
		<Sheet>
			<SheetTrigger
				render={
					<Button variant="outline" size="icon" className="h-12 w-12">
						<IconSearch className="h-5 w-5 text-muted-foreground" />
					</Button>
				}
			/>
			<SheetContent side="left" className="w-72 p-0">
				<AppSidebar />
			</SheetContent>
		</Sheet>
	);
}

function UserButton() {
	const { data: session } = useSession();
	const { handleLogout } = useLogout();

	if (!session?.user) return null;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button className="group relative flex h-12 w-12 items-center justify-center rounded-[calc(var(--radius)*1.8)] bg-linear-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:scale-105 hover:shadow-xl hover:shadow-primary/30">
						{session.user.image ? (
							<Image
								src={session.user.image}
								alt="user image"
								fill
								className="rounded-sm object-cover cursor-pointer"
							/>
						) : (
							<span className="text-lg font-bold">
								{session.user.name?.charAt(0).toUpperCase()}
							</span>
						)}
						<span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-emerald-500" />
					</Button>
				}
			/>
			<DropdownMenuGroup>
				<DropdownMenuContent align="end" className="w-72 p-3 cursor-pointer">
					<DropdownMenuLabel>
						<div className="flex items-center gap-3">
							<div className="flex h-12 w-12 items-center justify-center rounded-[calc(var(--radius)*1.8)] bg-linear-to-br from-primary to-primary/80 text-primary-foreground">
								{session.user.image ? (
									<Image
										src={session.user.image}
										alt="user image"
										fill
										className="rounded-sm object-cover"
									/>
								) : (
									<span className="text-lg font-bold">
										{session.user.name?.charAt(0).toUpperCase()}
									</span>
								)}
							</div>
							<div className="flex flex-col">
								<span className="font-semibold">{session.user.name}</span>
								<span className="text-xs text-muted-foreground">
									{session.user.email}
								</span>
							</div>
						</div>
					</DropdownMenuLabel>
					<DropdownMenuSeparator className="my-2" />
					<DropdownMenuItem className="cursor-pointer rounded-[calc(var(--radius)*1.4)]">
						<Link
							href="/dashboard/settings"
							className="flex items-center gap-2"
						>
							Settings
						</Link>
					</DropdownMenuItem>
					<DropdownMenuSeparator className="my-2" />
					<DropdownMenuItem
						className="cursor-pointer rounded-[calc(var(--radius)*1.4)] text-destructive focus:text-destructive"
						onClick={handleLogout}
					>
						<IconLogout className="h-4 w-4" />
						Sign out
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenuGroup>
		</DropdownMenu>
	);
}

function NotificationButton() {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<button className="relative flex h-12 w-12 items-center justify-center rounded-[calc(var(--radius)*1.8)] border border-border bg-background transition-all hover:bg-muted hover:border-border/80">
						<IconBell className="h-5 w-5 text-muted-foreground" />
						<span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-destructive" />
					</button>
				}
			/>
			<DropdownMenuContent align="end" className="w-80 p-4">
				<DropdownMenuGroup>
					<DropdownMenuLabel className="text-base">
						Notifications
					</DropdownMenuLabel>
					<DropdownMenuSeparator className="my-2" />
					<div className="text-sm text-muted-foreground py-4 text-center">
						No new notifications
					</div>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
