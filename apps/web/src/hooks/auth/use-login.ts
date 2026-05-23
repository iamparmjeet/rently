import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NavigationLinkMap } from "@/constants/navigation";
import { signIn } from "@/lib/auth-client";
import type { LoginFormType } from "@/types/auth-types";

export const useLogin = () => {
	const router = useRouter();
	const mutation = useMutation({
		onMutate: () => {
			const toastId = toast.loading("Signing in...");
			return { toastId };
		},
		mutationFn: async (data: LoginFormType) => {
			const result = await signIn.email({
				email: data.email,
				password: data.password,
			});
			// Errors by Better auth is going through useMutation
			if (result.error) {
				throw new Error(result.error.message);
			}
			return result;
		},
		onSuccess: (_, __, context) => {
			toast.success("Welcome back", { id: context.toastId });
			router.push(NavigationLinkMap.Dashboard.href);
		},
		onError: (err, _, context) => {
			toast.error(err.message, { id: context?.toastId });
			console.error(`Error while signing out: ${err.message}`);
		},
	});

	return { onSubmit: mutation.mutate, isLoading: mutation.isPending };
};
