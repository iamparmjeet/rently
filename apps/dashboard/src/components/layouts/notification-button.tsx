"use client";

import { Button } from "@rently/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@rently/ui/components/dropdown-menu";
import type { NotificationListItem } from "@rently/validators";
import {
	IconBell,
	IconBolt,
	IconFileText,
	IconHome,
} from "@tabler/icons-react";
import { useMarkAllAsRead, useMarkAsRead } from "@/hooks/notifications";
import {
	useNotifications,
	useUnreadCount,
} from "@/hooks/notifications/use-notifications";

function NotificationIcon({ type }: { type: string }) {
	if (type === "meter_reading_submitted")
		return <IconBolt className="size-4 text-amber-500" />;
	if (type === "invite_accepted")
		return <IconHome className="size-4 text-green-500" />;
	if (type === "lease_expiring_soon")
		return <IconFileText className="size-4 text-destructive" />;
	return <IconBell className="size-4 text-muted-foreground" />;
}

function timeAgo(date: Date): string {
	const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
	if (seconds < 60) return "just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

function NotificationRow({
	notification,
}: {
	notification: NotificationListItem;
}) {
	const { mutate: markAsRead } = useMarkAsRead();

	return (
		<div
			className={`flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50 ${
				notification.isRead ? "opacity-60" : ""
			}`}
		>
			<div className="mt-0.5 shrink-0">
				<NotificationIcon type={notification.type} />
			</div>
			<div className="min-w-0 flex-1">
				<p className={`text-sm ${notification.isRead ? "" : "font-semibold"}`}>
					{notification.title}
				</p>
				<p className="mt-0.5 text-muted-foreground text-xs leading-relaxed">
					{notification.message}
				</p>
				<p className="mt-1 text-muted-foreground text-xs">
					{timeAgo(notification.createdAt)}
				</p>
			</div>
			{!notification.isRead && (
				<Button
					variant="link"
					type="button"
					onClick={() => markAsRead(notification.id)}
					className="shrink-0 text-muted-foreground text-xs underline underline-offset-2 hover:text-foreground"
				>
					Dismiss
				</Button>
			)}
		</div>
	);
}

export function NotificationButton() {
	const { data: countData } = useUnreadCount();
	const { data, isLoading } = useNotifications();
	const { mutate: markAllAsRead, isPending } = useMarkAllAsRead();

	const unreadCount = countData?.count ?? 0;
	const notifs = data?.notifications ?? [];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="ghost"
						size="icon"
						className="relative size-11 rounded-xl border bg-gray-100 hover:border-border/80 hover:bg-muted"
					>
						<IconBell className="size-6 text-muted-foreground" />
						{unreadCount > 0 && (
							<span className="absolute top-7.5 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive font-bold text-[10px] text-white">
								{unreadCount > 9 ? "9+" : unreadCount}
							</span>
						)}
					</Button>
				}
			/>

			<DropdownMenuContent align="end" className="w-96 rounded-xl p-0">
				{/* Header — plain div, no Base UI primitives here */}
				<div className="flex items-center justify-between p-4 pb-2">
					{/* WHY: plain <p> not DropdownMenuLabel — GroupLabel requires a
					    Menu.Group ancestor for its context. This is custom layout,
					    not a semantic menu group label. */}
					<p className="font-bold text-base">
						Notifications
						{unreadCount > 0 && (
							<span className="ml-2 inline-flex size-5 items-center justify-center rounded-full bg-primary px-2 py-0.5 text-primary-foreground text-xs">
								{unreadCount}
							</span>
						)}
					</p>
					{unreadCount > 0 && (
						<Button
							variant="link"
							type="button"
							disabled={isPending}
							onClick={() => markAllAsRead()}
							className="text-muted-foreground text-xs underline underline-offset-2 hover:text-foreground disabled:opacity-50"
						>
							Mark all as read
						</Button>
					)}
				</div>

				<DropdownMenuSeparator />

				<DropdownMenuGroup className="max-h-105 overflow-y-auto p-2">
					{isLoading ? (
						<div className="py-8 text-center text-muted-foreground text-sm">
							Loading...
						</div>
					) : notifs.length === 0 ? (
						<div className="py-8 text-center text-muted-foreground text-sm">
							No notifications
						</div>
					) : (
						notifs.map((n) => <NotificationRow key={n.id} notification={n} />)
					)}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
