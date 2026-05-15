import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { client, orpc } from "@/utils/orpc";

// Create
export function useCreateLease() {
	const queryClient = useQueryClient();

	return useMutation({
		// client.property.create is fully typed — TypeScript knows the input shape
		mutationFn: (input: Parameters<typeof client.rent.lease.createLease>[0]) =>
			client.rent.lease.createLease(input),

		onSuccess: () => {
			// Invalidate the list so properties page re-fetches
			queryClient.invalidateQueries({
				queryKey: orpc.rent.lease.listLease.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.unit
					? orpc.rent.unit.listUnits?.key()
					: ["rent", "unit"],
			});
			toast.success("Lease created successfully");
		},

		onError: (error) => {
			console.error("Failed to create lease:", error.message);
			toast.error(`Failed to create lease: ${error.message}`);
		},
	});
}

// Update
export function useUpdateLease() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: Parameters<typeof client.rent.lease.updateLease>[0]) =>
			client.rent.lease.updateLease(input),

		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.lease.listLease.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.lease.getLeaseById.key({
					input: { id: variables.id },
				}),
			});
			toast.success("Lease Updated Successfully");
		},

		onError: (error) => {
			console.error("Failed to Update Lease data", error.message);
			toast.error(error.message);
		},
	});
}

export function useDeleteLease() {
	const queryClient = useQueryClient();

	return useMutation({
		// The mutationFn receives the property id as its argument
		mutationFn: (input: Parameters<typeof client.rent.lease.deleteLease>[0]) =>
			client.rent.lease.deleteLease(input),
		onSuccess: () => {
			// removeQueries = clear cache without refetching
			// invalidateQueries = clear + immediately trigger refetch
			// For delete, we just want to clear — nothing to refetch
			queryClient.removeQueries({
				queryKey: orpc.rent.lease.listLease.key(),
			});

			// Invalidate list so count updates
			queryClient.invalidateQueries({
				queryKey: orpc.rent.lease.listLease.key(),
			});
			toast.success("Lease deleted");
		},

		onError: (error) => {
			toast.error(`Failed to delete lease: ${error.message}`);
		},
	});
}
