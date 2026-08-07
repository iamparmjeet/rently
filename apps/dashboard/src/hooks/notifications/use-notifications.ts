"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

const MINUTES = (n: number) => n * 60 * 1_000;
const POLL_INTERVAL = MINUTES(360); // 6 Hours

export function useNotifications(enabled = false) {
	return useQuery({
		...orpc.notification.listNotifications.queryOptions(),
		enabled,
		// considered stale and re-fetched on window focus. Prevents over-fetching
		// when the user switches tabs frequently.
		staleTime: POLL_INTERVAL,
		refetchOnWindowFocus: false,
	});
}

export function useUnreadCount() {
	return useQuery({
		...orpc.notification.getUnreadCount.queryOptions(),
		refetchInterval: POLL_INTERVAL,
		staleTime: POLL_INTERVAL,
		refetchIntervalInBackground: false,
	});
}

export function useNotificationPreferences() {
	return useQuery(orpc.notification.getPreferences.queryOptions());
}
