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
		onSuccess: (_, __, context) => {
			toast.success("Welcome back", { id: context.toastId });
			console.log("onSuccess");
			console.log("cookie", document.cookie);
			const callbackUrl = searchParams.get("callbackUrl");

			// redirect
			if (callbackUrl && isTrustedCallbackUrl(callbackUrl)) {
				window.location.href = callbackUrl;
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
