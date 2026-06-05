import { env } from "@rently/env/web";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { signOut } from "@/lib/auth-client";

const WEB_URL = env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000";

export const useLogout = () => {
	const queryClient = useQueryClient();
	// future: const resetPropertyStore = usePropertyStore(s => s.reset)
	// future: const resetTenantStore = useTenantStore(s => s.reset)

	const mutation = useMutation({
		onMutate: () => {
			const toastId = toast.loading("Signing out...");
			return { toastId };
		},
		mutationFn: async () => {
			const result = await signOut();
			if (result.error) {
				throw new Error(result.error.message ?? "Sign out failed");
			}
			return result;
		},
		onSuccess: (_, __, context) => {
			queryClient.clear();
			// future: resetPropertyStore()
			// future: resetTenantStore()
			toast.success("Signed Out", { id: context.toastId });
			window.location.replace(`${WEB_URL}/login`);
		},
		onError: (err, _, context) => {
			toast.error("Error while signing out", { id: context?.toastId });
			console.error(`Error while signing out: ${err.message}`);
		},
	});

	return { handleLogout: () => mutation.mutate() };
};
