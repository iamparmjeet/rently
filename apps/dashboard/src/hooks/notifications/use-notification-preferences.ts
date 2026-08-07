"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { client, orpc } from "@/utils/orpc";

export function useUpdateNotificationPreferences() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (
			input: Parameters<typeof client.notification.updatePreferences>[0],
		) => client.notification.updatePreferences(input),
		onSuccess: (response) => {
			queryClient.setQueryData(
				orpc.notification.getPreferences.key(),
				response,
			);
			toast.success("Notification preferences saved");
		},
		onError: (error) => {
			toast.error(`Failed to save notification preferences: ${error.message}`);
		},
	});
}
