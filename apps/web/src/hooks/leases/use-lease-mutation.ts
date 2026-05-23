import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { client, orpc } from "@/utils/orpc";

// Create
export function useCreateLease() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Lease creating...");
			return { toastId };
		},
		// client.property.create is fully typed — TypeScript knows the input shape
		mutationFn: (input: Parameters<typeof client.rent.lease.createLease>[0]) =>
			client.rent.lease.createLease(input),

		onSuccess: (_, __, context) => {
			// Invalidate the list so properties page re-fetches
			queryClient.invalidateQueries({
				queryKey: orpc.rent.lease.listLeases.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.unit.listUnits.key(),
			});
			toast.success("Lease created successfully", { id: context.toastId });
		},

		onError: (error, _, context) => {
			console.error("Failed to create lease:", error.message);
			toast.error(`Failed to create lease: ${error.message}`, {
				id: context?.toastId,
			});
		},
	});
}

// Update
export function useUpdateLease() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Lease updating...");
			return { toastId };
		},
		mutationFn: (input: Parameters<typeof client.rent.lease.updateLease>[0]) =>
			client.rent.lease.updateLease(input),

		onSuccess: (_, variables, context) => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.lease.listLeases.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.lease.getLeaseById.key({
					input: { id: variables.id },
				}),
			});
			toast.success("Lease Updated Successfully", { id: context.toastId });
		},

		onError: (error, _, context) => {
			console.error("Failed to Update Lease data", error.message);
			toast.error(error.message, { id: context?.toastId });
		},
	});
}

export function useDeleteLease() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Lease deleting...");
			return { toastId };
		},
		// The mutationFn receives the property id as its argument
		mutationFn: (input: Parameters<typeof client.rent.lease.deleteLease>[0]) =>
			client.rent.lease.deleteLease(input),
		onSuccess: (_, __, context) => {
			// removeQueries = clear cache without refetching
			// invalidateQueries = clear + immediately trigger refetch
			// For delete, we just want to clear — nothing to refetch
			// queryClient.removeQueries({
			// 	queryKey: orpc.rent.lease.listLease.key(),
			// });

			// Invalidate list so count updates
			queryClient.invalidateQueries({
				queryKey: orpc.rent.lease.listLeases.key(),
			});
			toast.success("Lease deleted", { id: context.toastId });
		},

		onError: (error, _, context) => {
			toast.error(`Failed to delete lease: ${error.message}`, {
				id: context?.toastId,
			});
		},
	});
}
