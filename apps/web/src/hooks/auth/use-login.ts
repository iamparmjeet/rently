import { USER_ROLES } from "@rently/db/constants/user-roles";
import { env } from "@rently/env/web";
import type { LoginFormType } from "@rently/validators";
import { useMutation } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { signIn } from "@/lib/auth-client";
import { isTrustedCallbackUrl } from "@/lib/trusted-url";

export const useLogin = () => {
	const searchParams = useSearchParams();

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
		onSuccess: (result, __, context) => {
			toast.success("Welcome back", { id: context.toastId });
			const callbackUrl = searchParams.get("callbackUrl");

			// redirect
			if (callbackUrl && isTrustedCallbackUrl(callbackUrl)) {
				window.location.href = callbackUrl;
				return;
			}

			// role
			const role = result.data.user.role;

			if (role === USER_ROLES.TENANT) {
				window.location.href = env.NEXT_PUBLIC_TENANT_URL;
				return;
			}

			window.location.href = `${env.NEXT_PUBLIC_DASHBOARD_URL}/dashboard`;
		},
		onError: (err, _, context) => {
			toast.error(err.message, { id: context?.toastId });
			console.error(`Error while signing out: ${err.message}`);
		},
	});

	return {
		onSubmit: (data: LoginFormType) => mutation.mutate(data),
		isLoading: mutation.isPending,
	};
};
