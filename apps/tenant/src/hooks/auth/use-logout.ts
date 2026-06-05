import { env } from "@rently/env/web";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { signOut } from "@/lib/auth-client";

export const useLogout = () => {
	const queryClient = useQueryClient();

	const mutation = useMutation({
		onMutate: () => {
			const toastId = toast.loading("Signing out...");
			return { toastId };
		},
		mutationFn: async () => {
			const result = await signOut();
			if (result.error) {
				throw new Error(result.error.message);
			}
			return result;
		},
		onSuccess: (_, __, context) => {
			queryClient.clear();
			// future: resetPropertyStore()
			// future: resetTenantStore()
			toast.success("Signed Out", { id: context.toastId });
			window.location.replace(`${env.NEXT_PUBLIC_WEB_URL}/login`);
		},
		onError: (err, _, context) => {
			toast.error("Error while signing out", { id: context?.toastId });
			console.error(`Error while signing out: ${err.message}`);
		},
	});

	return { handleLogout: () => mutation.mutate() };
};
