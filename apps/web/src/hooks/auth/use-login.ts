import type { LoginFormType } from "@rently/validators";
import { useMutation } from "@tanstack/react-query";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { NavigationLinkMap, toRoute } from "@/constants/navigation";
import { signIn } from "@/lib/auth-client";
import { isTrustedCallbackUrl } from "@/lib/trusted-url";

export const useLogin = () => {
	const router = useRouter();

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
			const callbackUrl = searchParams.get("callbackUrl");

			// redirect
			if (callbackUrl && isTrustedCallbackUrl(callbackUrl)) {
				if (callbackUrl.startsWith("/")) {
					router.push(callbackUrl as unknown as Route<string>);
				} else {
					window.location.href = callbackUrl;
				}
				return;
			}
			router.push(toRoute(NavigationLinkMap.Dashboard.href));
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
