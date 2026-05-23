import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { client, orpc } from "@/utils/orpc";

// Create Tenant
export function useCreateTenant() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Creating tenant...");
			return { toastId };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.tenant.createTenant>[0],
		) => client.rent.tenant.createTenant(input),
		onSuccess: (_, __, context) => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.tenant.listTenants.key(),
			});
			toast.success("Tenant Created Successfully", { id: context.toastId });
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

// Send Email to Tenant
export function useSendEmailToTenant() {
	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Sending email...");
			return { toastId };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.tenant.sendEmailToTenant>[0],
		) => client.rent.tenant.sendEmailToTenant(input),
		onSuccess: (_, __, context) => {
			toast.success("Email sent successfully", { id: context.toastId });
		},
		onError: (error, _, context) => {
			console.error("Failed to send email:", error.message);
			toast.error(`Failed to send email: ${error.message}`, {
				id: context?.toastId,
			});
		},
	});
}

export function useSendPasswordReset() {
	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Sending reset email...");
			return { toastId };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.tenant.sendPasswordReset>[0],
		) => client.rent.tenant.sendPasswordReset(input),
		onSuccess: (_, __, context) => {
			toast.success("Password reset email sent to tenant", {
				id: context.toastId,
			});
		},
		onError: (error, _, context) => {
			console.error("Failed to send reset email:", error.message);
			toast.error(`Failed to send reset email: ${error.message}`, {
				id: context?.toastId,
			});
		},
	});
}
