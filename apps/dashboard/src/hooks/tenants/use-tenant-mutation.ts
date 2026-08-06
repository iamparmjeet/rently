import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useResendInvite } from "@/hooks/invites";
import { client, orpc } from "@/utils/orpc";

// Create an owner-prepared tenant invitation.
export function useCreateTenant() {
	const queryClient = useQueryClient();
	const resendInvite = useResendInvite();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Creating tenant...");
			return { toastId };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.tenant.createTenant>[0],
		) => client.rent.tenant.createTenant(input),
		onSuccess: (result, _, context) => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.tenant.listTenants.key(),
			});

			if (result.deliveryStatus === "failed") {
				toast.warning("Invitation saved, but the email was not delivered.", {
					id: context.toastId,
					duration: 10_000,
					action: {
						label: "Resend",
						onClick: () => {
							resendInvite.mutate({
								inviteId: result.invite.id,
							});
						},
					},
				});
				return;
			}

			toast.success("Tenant invitation email sent", { id: context.toastId });
		},
		onError: (error, _, context) => {
			console.error(`Failed to create Tenant: ${error}`);
			toast.error(`Failed to create Tenant: ${error.message}`, {
				id: context?.toastId,
			});
		},
	});
}

// Remove Tenant
export function useRemoveTenant() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Removing tenant...");
			return { toastId };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.tenant.removeTenant>[0],
		) => client.rent.tenant.removeTenant(input),
		onSuccess: (_, __, context) => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.tenant.listTenants.key(),
			});
			toast.success("Tenant Removed", { id: context.toastId });
		},
		onError: (error, _, context) => {
			console.error("Error Removing Tenant", error);
			toast.error("Error Removing Tenant.", { id: context?.toastId });
		},
	});
}

// Update Tenant Profile
export function useUpdateTenant() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Saving changes...");
			return { toastId };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.tenant.updateTenant>[0],
		) => client.rent.tenant.updateTenant(input),
		onSuccess: (_, variables, context) => {
			// Invalidate list — the card may show phone which could have changed
			queryClient.invalidateQueries({
				queryKey: orpc.rent.tenant.listTenants.key(),
			});
			// Invalidate the specific tenant detail if it's cached
			queryClient.invalidateQueries({
				queryKey: orpc.rent.tenant.getTenantById.key({
					input: { id: variables.tenantId },
				}),
			});
			toast.success("Tenant updated", { id: context.toastId });
		},
		onError: (error, _, context) => {
			console.error("Failed to update tenant:", error.message);
			toast.error(`Failed to update: ${error.message}`, {
				id: context?.toastId,
			});
		},
	});
}

type TenantListData = Awaited<
	ReturnType<typeof client.rent.tenant.listTenants>
>;
type TenantItem = TenantListData["tenants"][number];

// Optimistic Hooks
export function useSuspenseCreateTenant() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: async (variables) => {
			const toastId = toast.loading("Creating tenant...");

			// Cancel
			await queryClient.cancelQueries({
				queryKey: orpc.rent.tenant.listTenants.key(),
			});
			// snapshot
			const prevList = queryClient.getQueryData<TenantListData>(
				orpc.rent.tenant.listTenants.key(),
			);
			// Optimistic prepend the list
			const optimisticTenant: TenantItem = {
				...variables,
				id: `optimistic-${Date.now()}`,
				// Fields the server sets that the input doesn't have:
				avatarUrl: null,
				status: "accepted",
				createdAt: new Date(),
				updatedAt: new Date(),
				currentLease: null, // ← was missing; server joins this from leases table
				// If variables.phone is optional in input but required | null in output:
				phone: variables.phone ?? null,
			};
			queryClient.setQueryData<TenantListData>(
				orpc.rent.tenant.listTenants.key(),
				(old) => {
					if (!old) return old;
					return {
						...old,
						tenants: [optimisticTenant, ...old.tenants],
					};
				},
			);
			return { toastId, prevList };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.tenant.createTenant>[0],
		) => client.rent.tenant.createTenant(input),
		onError: (error, _, context) => {
			// Rollback
			if (context?.prevList !== undefined) {
				queryClient.setQueryData(
					orpc.rent.tenant.listTenants.key(),
					context.prevList,
				);
			}
			console.error(`Failed to create Tenant: ${error}`);
			toast.error(`Failed to create Tenant: ${error.message}`, {
				id: context?.toastId,
			});
		},
		onSuccess: (_, __, context) => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.tenant.listTenants.key(),
			});
			toast.success("Tenant Created Successfully", { id: context.toastId });
		},
		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.tenant.listTenants.key(),
			});
		},
	});
}

export function useSuspenseUpdateTenant() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: async (variables) => {
			const toastId = toast.loading("Saving changes...");

			await queryClient.cancelQueries({
				queryKey: orpc.rent.tenant.listTenants.key(),
			});

			const prevList = queryClient.getQueryData<TenantListData>(
				orpc.rent.tenant.listTenants.key(),
			);

			// Merge only the changed fields into the existing cached tenant
			// We find the tenant by tenantId and spread the new values over it
			queryClient.setQueryData<TenantListData>(
				orpc.rent.tenant.listTenants.key(),
				(old) => {
					if (!old) return old;
					return {
						...old,
						tenants: old.tenants.map((t) =>
							t.id === variables.tenantId
								? {
										...t,
										phone:
											variables.phone !== undefined
												? (variables.phone ?? null)
												: t.phone,
										id: t.id,
									}
								: t,
						),
					};
				},
			);

			return { toastId, prevList };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.tenant.updateTenant>[0],
		) => client.rent.tenant.updateTenant(input),
		onError: (error, _, context) => {
			if (context?.prevList !== undefined) {
				queryClient.setQueryData(
					orpc.rent.tenant.listTenants.key(),
					context.prevList,
				);
			}
			console.error("Failed to update tenant:", error.message);
			toast.error(`Failed to update: ${error.message}`, {
				id: context?.toastId,
			});
		},

		onSuccess: (_, variables, context) => {
			// Invalidate the individual tenant detail cache too
			queryClient.invalidateQueries({
				queryKey: orpc.rent.tenant.getTenantById.key({
					input: { id: variables.tenantId },
				}),
			});
			toast.success("Tenant updated", { id: context.toastId });
		},

		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.tenant.listTenants.key(),
			});
		},
	});
}

export function useSuspenseRemoveTenant() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: async (variables) => {
			const toastId = toast.loading("Removing tenant...");

			await queryClient.cancelQueries({
				queryKey: orpc.rent.tenant.listTenants.key(),
			});

			const prevList = queryClient.getQueryData<TenantListData>(
				orpc.rent.tenant.listTenants.key(),
			);

			// Optimistically remove from list immediately
			queryClient.setQueryData<TenantListData>(
				orpc.rent.tenant.listTenants.key(),
				(old) => {
					if (!old) return old;
					return {
						...old,
						tenants: old.tenants.filter((t) => t.id !== variables.tenantId),
					};
				},
			);

			return { toastId, prevList };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.tenant.removeTenant>[0],
		) => client.rent.tenant.removeTenant(input),

		onError: (error, _, context) => {
			// Rollback — restore the removed tenant
			if (context?.prevList !== undefined) {
				queryClient.setQueryData(
					orpc.rent.tenant.listTenants.key(),
					context.prevList,
				);
			}
			console.error("Error Removing Tenant", error);
			toast.error("Error Removing Tenant.", { id: context?.toastId });
		},

		onSuccess: (_, __, context) => {
			toast.success("Tenant Removed", { id: context.toastId });
		},

		onSettled: () => {
			// Use removeQueries for deletions — no point keeping stale data
			queryClient.removeQueries({
				queryKey: orpc.rent.tenant.listTenants.key(),
			});
		},
	});
}
