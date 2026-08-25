"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

const MINUTES = (n: number) => n * 60 * 1_000;
const POLL_INTERVAL = MINUTES(5); // 5 minutes — was 6h, badge stale (audit P2)

export function useNotifications(enabled = false) {
	return useQuery({
		...orpc.notification.listNotifications.queryOptions(),
		enabled,
		staleTime: POLL_INTERVAL,
		refetchOnWindowFocus: true,
	});
}

export function useUnreadCount() {
	return useQuery({
		...orpc.notification.getUnreadCount.queryOptions(),
		refetchInterval: POLL_INTERVAL,
		staleTime: POLL_INTERVAL,
		refetchIntervalInBackground: true,
		refetchOnWindowFocus: true,
	});
}

export function useNotificationPreferences() {
	return useQuery(orpc.notification.getPreferences.queryOptions());
}
