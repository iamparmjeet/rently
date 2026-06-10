import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { client, orpc } from "@/utils/orpc";

export function useCreateInvite() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Sending invite...");
			return { toastId };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.invite.createInvite>[0],
		) => client.rent.invite.createInvite(input),
		onSuccess: (_, __, context) => {
			// WHY invalidate tenants: listTenants returns invite-based tenant
			// records — a new pending invite shows up as a new card on the list.
			queryClient.invalidateQueries({
				queryKey: orpc.rent.tenant.listTenants.key(),
			});
			toast.success("Invite sent successfully", { id: context.toastId });
		},
		onError: (error, _, context) => {
			toast.error(`Failed to send invite: ${error.message}`, {
				id: context?.toastId,
			});
		},
	});
}
