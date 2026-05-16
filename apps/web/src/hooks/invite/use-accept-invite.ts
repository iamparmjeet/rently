import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { client } from "@/utils/orpc";

export function useAcceptInvite() {
	const router = useRouter();

	return useMutation({
		mutationFn: (
			input: Parameters<typeof client.rent.invite.acceptInvite>[0],
		) => client.rent.invite.acceptInvite(input),

		onSuccess: () => {
			toast.success("Account created - Plese log in.");
			setTimeout(() => router.push("/login"), 1500);
		},

		onError: (error: Error) => {
			toast.error(error.message || "Failed to accept invite. Try Again");
			console.error(`Faile to accept Invite: ${error.message}`);
		},
	});
}
