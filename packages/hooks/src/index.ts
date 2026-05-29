import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useClient } from "./orpc-context";

// Send Email to Tenant
export function useSendEmailToTenant() {
	const client = useClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Sending email...");
			return { toastId };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.tenant.sendEmailToTenant>[0],
		) => client.rent.tenant.sendEmailToTenant(input),
		onSuccess: (_, __, context) => {
			toast.success("Email sent successfully", { id: context.toastId });
		},
		onError: (error, _, context) => {
			console.error("Failed to send email:", error.message);
			toast.error(`Failed to send email: ${error.message}`, {
				id: context?.toastId,
			});
		},
	});
}

export function useSendPasswordReset() {
	const client = useClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Sending reset email...");
			return { toastId };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.tenant.sendPasswordReset>[0],
		) => client.rent.tenant.sendPasswordReset(input),
		onSuccess: (_, __, context) => {
			toast.success("Password reset email sent to tenant", {
				id: context.toastId,
			});
		},
		onError: (error, _, context) => {
			console.error("Failed to send reset email:", error.message);
			toast.error(`Failed to send reset email: ${error.message}`, {
				id: context?.toastId,
			});
		},
	});
}
