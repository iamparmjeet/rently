import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { signOut } from "@/lib/auth-client";

export const useLogout = () => {
	const router = useRouter();
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
				throw new Error(result.error.message);
			}
			return result;
		},
		onSuccess: (_, __, context) => {
			queryClient.clear();
			// future: resetPropertyStore()
			// future: resetTenantStore()
			toast.success("Signed Out", { id: context.toastId });
			router.push("/login" as Route);
		},
		onError: (err, _, context) => {
			toast.error("Error while signing out", { id: context?.toastId });
			console.error(`Error while signing out: ${err.message}`);
		},
	});

	return { handleLogout: () => mutation.mutate };
};
