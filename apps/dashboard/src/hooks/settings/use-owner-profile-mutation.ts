import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { client, orpc } from "@/utils/orpc";

export function useUpsertOwnerProfile() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (
			input: Parameters<typeof client.rent.ownerProfile.upsertOwnerProfile>[0],
		) => client.rent.ownerProfile.upsertOwnerProfile(input),

		onSuccess: () => {
			// why onSuccess (not onSettled): this is non-optimistic — we wait for server confirmation before invalidating, per project convention.
			queryClient.invalidateQueries({
				queryKey: orpc.rent.ownerProfile.getOwnerProfile.key(),
			});
			toast.success("Business details saved");
		},

		onError: (error) => {
			toast.error(`Failed to save: ${error.message}`);
		},
	});
}
