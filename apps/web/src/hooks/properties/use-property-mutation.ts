import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { client, orpc } from "@/utils/orpc";

// Create
export function useCreateProperty() {
	const queryClient = useQueryClient();

	return useMutation({
		// client.property.create is fully typed — TypeScript knows the input shape
		mutationFn: (
			input: Parameters<typeof client.rent.property.createProperty>[0],
		) => client.rent.property.createProperty(input),

		onSuccess: () => {
			// Invalidate the list so properties page re-fetches
			queryClient.invalidateQueries({
				queryKey: orpc.rent.property.listProperties.key(),
			});
			toast.success("Property created successfully");
		},

		onError: (error) => {
			console.error("Failed to create property:", error.message);
			toast.error(`Failed to create property: ${error.message}`);
		},
	});
}

// Update
export function useUpdateProperty() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (
			input: Parameters<typeof client.rent.property.updateProperty>[0],
		) => client.rent.property.updateProperty(input),

		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.property.listProperties.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.property.getPropertyById.key({
					input: { id: variables.id },
				}),
			});
			toast.success("Property Updated Successfully");
		},

		onError: (error) => {
			console.error("Failed to Update Property data", error.message);
			toast.error(error.message);
		},
	});
}

export function useDeleteProperty() {
	const queryClient = useQueryClient();

	return useMutation({
		// The mutationFn receives the property id as its argument
		mutationFn: (
			input: Parameters<typeof client.rent.property.deleteProperty>[0],
		) => client.rent.property.deleteProperty(input),
		onSuccess: () => {
			// removeQueries = clear cache without refetching
			// invalidateQueries = clear + immediately trigger refetch
			// For delete, we just want to clear — nothing to refetch
			queryClient.removeQueries({
				queryKey: orpc.rent.property.listProperties.key(),
			});

			// Invalidate list so count updates
			queryClient.invalidateQueries({
				queryKey: orpc.rent.property.listProperties.key(),
			});
			toast.success("Property deleted");
		},

		onError: (error) => {
			toast.error(`Failed to delete property: ${error.message}`);
		},
	});
}
