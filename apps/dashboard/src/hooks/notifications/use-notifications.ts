"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

const POLL_INTERVAL = 30_000;

export function useNotifications() {
	return useQuery({
		...orpc.notification.listNotifications.queryOptions(),
		refetchInterval: POLL_INTERVAL,
		// WHY 10s staleTime: the data is always at most 10s old before being
		// considered stale and re-fetched on window focus. Prevents over-fetching
		// when the user switches tabs frequently.
		staleTime: 10_000,
	});
}

export function useUnreadCount() {
	return useQuery({
		...orpc.notification.getUnreadCount.queryOptions(),
		refetchInterval: POLL_INTERVAL,
		staleTime: 10_000,
	});
}
