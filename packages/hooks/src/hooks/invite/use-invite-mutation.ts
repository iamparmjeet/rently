import { useClient, useORPC } from "@rently/hooks/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Create
export function useCreateInvite() {
	const queryClient = useQueryClient();
	const client = useClient();
	const orpc = useORPC();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Creating invite...");
			return { toastId };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.invite.createInvite>[0],
		) => client.rent.invite.createInvite(input),
		onSuccess: (_, __, context) => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.invite.listInvites.key(),
			});
			toast.success("Invite Send", { id: context.toastId });
		},
		onError: (err, _, context) => {
			console.error(`Failed to create invite, ${err.message}`);
			toast.error("Failed to create invite", { id: context?.toastId });
		},
	});
}
