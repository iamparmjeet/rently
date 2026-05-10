import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { signOut } from "@/lib/auth-client";

export const useLogout = () => {
	const router = useRouter();
	// future: const queryClient = useQueryClient()
	// future: const resetPropertyStore = usePropertyStore(s => s.reset)
	// future: const resetTenantStore = useTenantStore(s => s.reset)

	const handleLogout = async () => {
		const toastId = toast.loading("Signing out...");

		await signOut({
			fetchOptions: {
				onSuccess: () => {
					// future: queryClient.clear()
					// future: resetPropertyStore()
					// future: resetTenantStore()
					toast.success("Signed out successfully.", { id: toastId });
					router.push("/login");
				},
				onError: (err) => {
					toast.error("Failed to sign out.", { id: toastId });
					console.error("Signout Err", err);
				},
			},
		});
	};
	return { handleLogout };
};
