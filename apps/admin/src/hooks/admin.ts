"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { client, orpc } from "@/utils/orpc";

export function useAdminOverview() {
	return useQuery(orpc.admin.stats.getOverview.queryOptions());
}

export function useAdminUsers(
	input: Parameters<typeof client.admin.users.list>[0],
) {
	return useQuery(orpc.admin.users.list.queryOptions({ input }));
}

export function useAdminUser(userId: string) {
	return useQuery(
		orpc.admin.users.get.queryOptions({
			input: { userId },
			enabled: Boolean(userId),
		}),
	);
}

export function useAdminSubscriptions(
	input: Parameters<typeof client.admin.subscriptions.list>[0],
) {
	return useQuery(orpc.admin.subscriptions.list.queryOptions({ input }));
}

export function usePlans() {
	return useQuery(orpc.subscription.listPlans.queryOptions());
}

export function useRecordSubscriptionPayment() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (
			input: Parameters<typeof client.admin.subscriptions.recordPayment>[0],
		) => client.admin.subscriptions.recordPayment(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: orpc.admin.key() });
			toast.success("Subscription payment recorded");
		},
		onError: (error) => toast.error(error.message),
	});
}

export function useAdminBetaCodes(
	input: Parameters<typeof client.admin.betaCodes.list>[0],
) {
	return useQuery(orpc.admin.betaCodes.list.queryOptions({ input }));
}

export function useCreateBetaCode() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: Parameters<typeof client.admin.betaCodes.create>[0]) =>
			client.admin.betaCodes.create(input),
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: orpc.admin.betaCodes.key() });
			queryClient.invalidateQueries({ queryKey: orpc.admin.auditLogs.key() });
			toast.success(`Created ${data.betaCode.code}`);
		},
		onError: (error) => toast.error(error.message),
	});
}

export function useExpireBetaCode() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: Parameters<typeof client.admin.betaCodes.expire>[0]) =>
			client.admin.betaCodes.expire(input),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: orpc.admin.betaCodes.key() });
			queryClient.invalidateQueries({ queryKey: orpc.admin.auditLogs.key() });
			toast.success("Beta code expired");
		},
		onError: (error) => toast.error(error.message),
	});
}

export function useAdminAuditLogs(
	input: Parameters<typeof client.admin.auditLogs.list>[0],
) {
	return useQuery(orpc.admin.auditLogs.list.queryOptions({ input }));
}
