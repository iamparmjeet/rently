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

			if (result.error) {
				if (result.error.status === 403) {
					return {
						kind: "verification-required" as const,
						email: data.email,
					};
				}

				throw new Error(result.error.message);
			}

			return {
				kind: "signed-in" as const,
				user: result.data.user,
			};
		},

		onSuccess: (result, __, context) => {
			const callbackUrl = searchParams.get("callbackUrl");
			const safeCallbackUrl =
				callbackUrl && isTrustedCallbackUrl(callbackUrl)
					? callbackUrl
					: undefined;

			if (result.kind === "verification-required") {
				const verificationUrl = new URL(
					"/verify-email",
					env.NEXT_PUBLIC_WEB_URL,
				);

				verificationUrl.searchParams.set("email", result.email);

				if (safeCallbackUrl) {
					verificationUrl.searchParams.set("callbackUrl", safeCallbackUrl);
				}
				window.location.href = verificationUrl.toString();
				return;
			}

			toast.success("Welcome back", { id: context.toastId });

			// redirect
			if (safeCallbackUrl) {
				window.location.href = safeCallbackUrl;
				return;
			}

			// role
			const role = result.user.role;

			if (role === USER_ROLES.TENANT) {
				window.location.href = env.NEXT_PUBLIC_TENANT_URL;
				return;
			}

			if (role === USER_ROLES.ADMIN) {
				window.location.href = `${env.NEXT_PUBLIC_ADMIN_URL}/dashboard`;
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
