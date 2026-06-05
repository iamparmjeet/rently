import { useClient } from "@rently/hooks/orpc";
import { useMutation } from "@tanstack/react-query";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function useAcceptInvite() {
	const router = useRouter();
	const client = useClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Accepting Invite...");
			return { toastId };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.invite.acceptInvite>[0],
		) => client.rent.invite.acceptInvite(input),

		onSuccess: (_, __, context) => {
			toast.success("Account created - Please log in.", {
				id: context.toastId,
			});
			router.push("/login" as Route);
		},

		onError: (error, _, context) => {
			// TODO: replace with logger when observability
			if (error.message === "CONFLICT") {
				toast.error("This invite has already been used. Please log in.");
				router.push("/login" as Route);
				return;
			}
			toast.error(error.message || "Failed to accept invite. Try Again", {
				id: context?.toastId,
			});
			console.error(`Failed to accept Invite: ${error.message}`);
		},
	});
}
