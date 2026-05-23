import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { client, orpc } from "@/utils/orpc";

// Create
export function useCreateProperty() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Creating Property...");
			return { toastId };
		},
		// client.property.create is fully typed — TypeScript knows the input shape
		mutationFn: (
			input: Parameters<typeof client.rent.property.createProperty>[0],
		) => client.rent.property.createProperty(input),

		onSuccess: (_, __, context) => {
			// Invalidate the list so properties page re-fetches
			queryClient.invalidateQueries({
				queryKey: orpc.rent.property.listProperties.key(),
			});
			toast.success("Property created successfully", { id: context.toastId });
		},

		onError: (error, _, context) => {
			console.error("Failed to create property:", error.message);
			toast.error(`Failed to create property: ${error.message}`, {
				id: context?.toastId,
			});
		},
	});
}

// Update
export function useUpdateProperty() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Updating Property...");
			return { toastId };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.property.updateProperty>[0],
		) => client.rent.property.updateProperty(input),

		onSuccess: (_, variables, context) => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.property.listProperties.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.property.getPropertyById.key({
					input: { id: variables.id },
				}),
			});
			toast.success("Property Updated Successfully", { id: context.toastId });
		},

		onError: (error, _, context) => {
			console.error("Failed to Update Property data", error.message);
			toast.error(`Failed to update Property data, ${error.message}`, {
				id: context?.toastId,
			});
		},
	});
}

export function useDeleteProperty() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Deleting Property...");
			return { toastId };
		},
		// The mutationFn receives the property id as its argument
		mutationFn: (
			input: Parameters<typeof client.rent.property.deleteProperty>[0],
		) => client.rent.property.deleteProperty(input),
		onSuccess: (_, __, context) => {
			// invalidateQueries (not removeQueries) because the list page
			// is still mounted after delete — we want an immediate UI update,
			// not lazy re-population on next navigation

			// Invalidate list so count updates
			queryClient.invalidateQueries({
				queryKey: orpc.rent.property.listProperties.key(),
			});
			toast.success("Property deleted", { id: context.toastId });
		},

		onError: (error, _, context) => {
			toast.error(`Failed to delete property: ${error.message}`, {
				id: context?.toastId,
			});
		},
	});
}
