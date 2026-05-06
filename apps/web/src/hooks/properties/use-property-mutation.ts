import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { client, unwrap } from "@/lib/api-client";
import type { ApiError } from "@/types/api-types";
import { propertyKeys } from "./property-keys";

interface CreatePropertyInput {
	name: string;
	address: string;
	type: "residential" | "commercial";
}

interface UpdatePropertyInput {
	name?: string;
	address?: string;
	type?: "residential" | "commercial";
}

// Create
export function useCreateProperty() {
	const queryClient = useQueryClient();
	return useMutation<unknown, ApiError, CreatePropertyInput>({
		mutationFn: async (input) =>
			unwrap(client.api.v1.properties.$post({ json: input })),

		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
			toast.success("Property Created successfully");
		},

		onError: (error) => {
			console.error("Failed to Create Property", error.message);
			toast.error(`Failed to Create Property, ${error.message}`);
		},
	});
}

// Update
export function useUpdateProperty(id: string) {
	const queryClient = useQueryClient();

	return useMutation<unknown, ApiError, UpdatePropertyInput>({
		mutationFn: (input) =>
			unwrap(
				client.api.v1.properties[":id"].$put({
					param: { id },
					json: input,
				}),
			),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: propertyKeys.detail(id) });
			queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
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

	return useMutation<unknown, ApiError, string>({
		// The mutationFn receives the property id as its argument
		mutationFn: async (id) =>
			unwrap(client.api.v1.properties[":id"].$delete({ param: { id } })),

		onSuccess: (_, deletedId) => {
			// Invalidate all property queries
			queryClient.invalidateQueries({ queryKey: propertyKeys.all });
			toast.success("Property deleted");
		},

		onError: (error) => {
			toast.error(error.message);
		},
	});
}
