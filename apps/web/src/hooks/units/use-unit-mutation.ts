import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { client, orpc } from "@/utils/orpc";

// create
export function useCreateUnit() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Creating unit...");
			return { toastId };
		},
		mutationFn: (input: Parameters<typeof client.rent.unit.createUnit>[0]) =>
			client.rent.unit.createUnit(input),
		onSuccess: (_, __, context) => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.unit.listUnits.key(),
			});
			toast.success("Unit Created Successfully", { id: context.toastId });
		},
		onError: (error, _, context) => {
			console.error(`Failed to Create Unit: ${error}`);
			toast.error(`Failed to Create Unit: ${error.message}`, {
				id: context?.toastId,
			});
		},
	});
}

// Update
export function useUpdateUnit() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Updating unit...");
			return { toastId };
		},
		mutationFn: (input: Parameters<typeof client.rent.unit.updateUnit>[0]) =>
			client.rent.unit.updateUnit(input),

		onSuccess: (_, variables, context) => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.unit.listUnits.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.unit.getUnitById.key({
					input: { id: variables.id },
				}),
			});
			toast.success("Unit Updated Successfully", { id: context.toastId });
		},

		onError: (error, _, context) => {
			console.error("Failed to Update Unit data", error.message);
			toast.error(`Failed to update unit data, ${error.message}`, {
				id: context?.toastId,
			});
		},
	});
}

export function useDeleteUnit() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Removing unit...");
			return { toastId };
		},
		// The mutationFn receives the property id as its argument
		mutationFn: (input: Parameters<typeof client.rent.unit.deleteUnit>[0]) =>
			client.rent.unit.deleteUnit(input),
		onSuccess: (_, variables, context) => {
			// Invalidate list so the deleted unit disappers and count updates
			queryClient.invalidateQueries({
				queryKey: orpc.rent.unit.listUnits.key(),
			});
			// Also remove the specific unit from cache
			queryClient.removeQueries({
				queryKey: orpc.rent.unit.getUnitById.key({
					input: { id: variables.id },
				}),
			});
			toast.success("Unit deleted", { id: context.toastId });
		},

		onError: (error, _, context) => {
			toast.error(`Failed to delete unit: ${error.message}`, {
				id: context?.toastId,
			});
		},
	});
}
