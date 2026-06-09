"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client, orpc } from "@/utils/orpc";

function invalidateNotifications(
	queryClient: ReturnType<typeof useQueryClient>,
) {
	queryClient.invalidateQueries({
		queryKey: orpc.notification.listNotifications.key(),
	});
	queryClient.invalidateQueries({
		queryKey: orpc.notification.getUnreadCount.key(),
	});
}

export function useMarkAsRead() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => client.notification.markAsRead({ id }),
		onSuccess: () => invalidateNotifications(queryClient),
	});
}

export function useMarkAllAsRead() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: () => client.notification.markAllAsRead(),
		onSuccess: () => invalidateNotifications(queryClient),
	});
}
