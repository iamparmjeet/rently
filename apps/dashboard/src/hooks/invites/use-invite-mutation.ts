import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { client } from "@/utils/orpc";

export function useResendInvite() {
	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Resending invitation...");
			return { toastId };
		},

		mutationFn: (
			input: Parameters<typeof client.rent.invite.resendInvite>[0],
		) => client.rent.invite.resendInvite(input),

		onSuccess: (_, __, context) => {
			toast.success("Invitation email sent", {
				id: context.toastId,
			});
		},

		onError: (error, _, context) => {
			toast.error(`Could not resend invitation: ${error.message}`, {
				id: context?.toastId,
			});
		},
	});
}

export function useCreateInvite() {
	const resendInvite = useResendInvite();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Creating invitation...");
			return { toastId };
		},

		mutationFn: (
			input: Parameters<typeof client.rent.invite.createInvite>[0],
		) => client.rent.invite.createInvite(input),

		onSuccess: (result, _, context) => {
			if (result.deliveryStatus === "failed") {
				toast.warning("Invitation saved, but the email was not delivered.", {
					id: context.toastId,
					duration: 10_000,
					action: {
						label: "Resend",
						onClick: () => {
							resendInvite.mutate({
								inviteId: result.invite.id,
							});
						},
					},
				});
				return;
			}

			toast.success("Invitation email sent", {
				id: context.toastId,
			});
		},

		onError: (error, _, context) => {
			toast.error(`Could not create invitation: ${error.message}`, {
				id: context?.toastId,
			});
		},
	});
}
