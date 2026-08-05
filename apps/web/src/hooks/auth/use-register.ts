import { env } from "@rently/env/web";
import type { RegisterFormType } from "@rently/validators";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { signUp } from "@/lib/auth-client";

export const useRegister = () => {
	const mutation = useMutation({
		onMutate: () => {
			const toastId = toast.loading("Creating your account...");
			return { toastId };
		},
		mutationFn: async (data: RegisterFormType) => {
			const postVerificationUrl = data.betaCode?.trim()
				? `${env.NEXT_PUBLIC_DASHBOARD_URL}/subscriptions`
				: `${env.NEXT_PUBLIC_WEB_URL}/callback`;

			const result = await signUp.email({
				email: data.email,
				password: data.password,
				name: data.name,
				phone: data.phone,
				callbackURL: postVerificationUrl,
			});

			if (result.error) throw new Error(result.error.message);

			return { postVerificationUrl };
		},

		onSuccess: ({ postVerificationUrl }, variables, context) => {
			const verificationUrl = new URL("/verify-email", env.NEXT_PUBLIC_WEB_URL);

			verificationUrl.searchParams.set("email", variables.email);
			verificationUrl.searchParams.set("callbackUrl", postVerificationUrl);

			toast.success("Check your inbox to verify your email.", {
				id: context.toastId,
			});

			window.location.href = verificationUrl.toString();
		},

		onError: (err, _, context) => {
			toast.error(err.message, { id: context?.toastId });
		},
	});

	return {
		onSubmit: (data: RegisterFormType) => mutation.mutate(data),
		isLoading: mutation.isPending,
	};
};
