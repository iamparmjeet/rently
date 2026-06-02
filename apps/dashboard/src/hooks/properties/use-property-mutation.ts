import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-client";
import { client, orpc } from "@/utils/orpc";

// type Safe update the cache in onMutate
type PropertyListData = Awaited<
	ReturnType<typeof client.rent.property.listProperties>
>;

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

// ********** Optimistic hooks

export function useOptimisticCreateProperty() {
	const queryClient = useQueryClient();
	const { data: session } = useSession();

	return useMutation({
		onMutate: async (variables) => {
			const toastId = toast.loading("Creating property...");

			// Cancel in-flight fetches — prevent race condition overwriting our optimistic state
			await queryClient.cancelQueries({
				queryKey: orpc.rent.property.listProperties.key(),
			});

			// Snapshot for rollback
			const previousList = queryClient.getQueryData<PropertyListData>(
				orpc.rent.property.listProperties.key(),
			);

			// Optimistically prepend to list
			// We don't know the real id yet — use a temp string
			// Server data will replace this after onSettled invalidates
			queryClient.setQueryData<PropertyListData>(
				orpc.rent.property.listProperties.key(),
				(old) => {
					if (!old) return old;
					return {
						...old,
						properties: [
							{
								// Spread variables to show the user's input immediately
								...variables,
								id: `optimistic-${Date.now()}`, // temp id
								ownerId: session?.user.id ?? "",
								yearBuilt: variables.yearBuilt ?? null,
								totalArea: variables.totalArea ?? null,
								floors: variables.floors ?? null,
								description: variables.description ?? null,
								createdAt: new Date(),
								updatedAt: new Date(),
							},
							...old.properties,
						],
					};
				},
			);

			return { toastId, previousList };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.property.createProperty>[0],
		) => client.rent.property.createProperty(input),

		// onError
		onError: (error, _, context) => {
			// Rollback - restore the Snapshot
			if (context?.previousList !== undefined) {
				queryClient.setQueryData(
					orpc.rent.property.listProperties.key(),
					context.previousList,
				);
			}
			toast.error(`Failed to create property: ${error.message}`, {
				id: context?.toastId,
			});
			// TODO: Remove
			console.error("Failed to create Property:", error);
		},
		// onSuccess
		onSuccess: (_, __, context) => {
			toast.success("Property created successfully", { id: context.toastId });
		},
		// onSettled
		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.property.listProperties.key(),
			});
		},
	});
}

export function useOptimisticUpdateProperty() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: async (variables) => {
			const toastId = toast.loading("Updating Property...");

			// Cancel both caches
			await queryClient.cancelQueries({
				queryKey: orpc.rent.property.listProperties.key(),
			});
			await queryClient.cancelQueries({
				queryKey: orpc.rent.property.getPropertyById.key({
					input: { id: variables.id },
				}),
			});

			// Snapshot
			const previousList = queryClient.getQueryData<PropertyListData>(
				orpc.rent.property.listProperties.key(),
			);
			const previousDetail = queryClient.getQueryData(
				orpc.rent.property.getPropertyById.key({
					input: { id: variables.id },
				}),
			);

			// Optimistic Update the list
			queryClient.setQueryData<PropertyListData>(
				orpc.rent.property.listProperties.key(),
				(old) => {
					if (!old) return old;
					return {
						...old,
						properties: old.properties.map((p) =>
							p.id === variables.id ? { ...p, ...variables } : p,
						),
					};
				},
			);

			// Optimistic update the details
			queryClient.setQueryData(
				orpc.rent.property.getPropertyById.key({ input: { id: variables.id } }),
				(old) => {
					if (!old || typeof old !== "object") return old;
					return { ...old, ...variables };
				},
			);

			return { toastId, previousDetail, previousList, id: variables.id };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.property.updateProperty>[0],
		) => client.rent.property.updateProperty(input),

		// onError
		onError: (error, _, context) => {
			// rollback both caches
			if (context?.previousList !== undefined) {
				queryClient.setQueryData(
					orpc.rent.property.listProperties.key(),
					context.previousList,
				);
			}

			if (context?.previousDetail !== undefined) {
				queryClient.setQueryData(
					orpc.rent.property.getPropertyById.key({
						input: { id: context.id },
					}),
					context.previousDetail,
				);
			}
			console.error("Failed to Update Property data", error.message);
			toast.error(`Failed to update Property data, ${error.message}`, {
				id: context?.toastId,
			});
		},
		// On success
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
		// onSettled
		onSettled: (_, __, variables) => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.property.listProperties.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.property.getPropertyById.key({
					input: { id: variables.id },
				}),
			});
		},
	});
}

export function useOptimisticDeleteProperty() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: async (variables) => {
			const toastId = toast.loading("Deleting Property...");

			// Cancel
			await queryClient.cancelQueries({
				queryKey: orpc.rent.property.listProperties.key(),
			});

			// Snapshot
			const prevList = queryClient.getQueryData<PropertyListData>(
				orpc.rent.property.listProperties.key(),
			);

			// Optimistic remove from list
			queryClient.setQueryData<PropertyListData>(
				orpc.rent.property.listProperties.key(),
				(old) => {
					if (!old) return old;
					return {
						...old,
						properties: old.properties.filter((p) => p.id !== variables.id),
					};
				},
			);

			return { toastId, prevList, id: variables.id };
		},
		// The mutationFn receives the property id as its argument
		mutationFn: (
			input: Parameters<typeof client.rent.property.deleteProperty>[0],
		) => client.rent.property.deleteProperty(input),
		// onError
		onError: (error, _, context) => {
			// Rollback the list
			if (context?.prevList !== undefined) {
				queryClient.setQueryData(
					orpc.rent.property.listProperties.key(),
					context.prevList,
				);
			}
			toast.error(`Failed to delete property: ${error.message}`, {
				id: context?.toastId,
			});
		},
		// onSuccess
		onSuccess: (_, __, context) => {
			// remove Detail from cache
			queryClient.removeQueries({
				queryKey: orpc.rent.property.getPropertyById.key({
					input: { id: context.id },
				}),
			});
			// invalidateQueries (not removeQueries) because the list page
			// is still mounted after delete — we want an immediate UI update,
			// not lazy re-population on next navigation
			// Invalidate list so count updates
			queryClient.invalidateQueries({
				queryKey: orpc.rent.property.listProperties.key(),
			});
			toast.success("Property deleted", { id: context.toastId });
		},
		// onSettled
		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.property.listProperties.key(),
			});
		},
	});
}
