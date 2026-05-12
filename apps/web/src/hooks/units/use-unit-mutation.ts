import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { client, orpc } from "@/utils/orpc";

// create
export function useCreateUnit() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: Parameters<typeof client.rent.unit.createUnit>[0]) =>
			client.rent.unit.createUnit(input),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.unit.listUnits.key(),
			});
			toast.success("Unit Created Successfully");
		},
		onError: (error) => {
			console.error(`Failed to Create Unit: ${error}`);
			toast.error(`Failed to Create Unit: ${error.message}`);
		},
	});
}

// Update
export function useUpdateUnit() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: Parameters<typeof client.rent.unit.updateUnit>[0]) =>
			client.rent.unit.updateUnit(input),

		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.unit.listUnits.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.unit.getUnitById.key({
					input: { id: variables.id },
				}),
			});
			toast.success("Unit Updated Successfully");
		},

		onError: (error) => {
			console.error("Failed to Update Unit data", error.message);
			toast.error(error.message);
		},
	});
}

export function useDeleteUnit() {
	const queryClient = useQueryClient();

	return useMutation({
		// The mutationFn receives the property id as its argument
		mutationFn: (input: Parameters<typeof client.rent.unit.deleteUnit>[0]) =>
			client.rent.unit.deleteUnit(input),
		onSuccess: () => {
			// removeQueries = clear cache without refetching
			// invalidateQueries = clear + immediately trigger refetch
			// For delete, we just want to clear — nothing to refetch
			queryClient.removeQueries({
				queryKey: orpc.rent.unit.listUnits.key(),
			});

			// Invalidate list so count updates
			queryClient.invalidateQueries({
				queryKey: orpc.rent.unit.listUnits.key(),
			});
			toast.success("Unit deleted");
		},

		onError: (error) => {
			toast.error(`Failed to delete unit: ${error.message}`);
		},
	});
}
