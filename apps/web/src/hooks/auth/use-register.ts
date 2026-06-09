import { env } from "@rently/env/web";
import type { RegisterFormType } from "@rently/validators";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { NavigationLinkMap } from "@/constants/navigation";
import { signUp } from "@/lib/auth-client";
import { client } from "@/utils/orpc";

export const useRegister = () => {
	const mutation = useMutation({
		onMutate: () => {
			const toastId = toast.loading("Creating your account...");
			return { toastId };
		},
		mutationFn: async (data: RegisterFormType) => {
			const result = await signUp.email({
				email: data.email,
				password: data.password,
				name: data.name,
				phone: data.phone,
				callbackURL: `${env.NEXT_PUBLIC_APP_URL}/${NavigationLinkMap.Dashboard.href}`,
			});
			if (result.error) throw new Error(result.error.message);

			// 2  - Redeem Beta code if provided
			if (data.betaCode?.trim()) {
				try {
					await client.subscription.redeemBetaCode({
						code: data.betaCode.trim().toUpperCase(),
					});
					toast.info("Beta access activated! You're on Pro.", {
						duration: 5000,
					});
				} catch {
					toast.warning(
						"Beta code not applied - You're on the free plan. Try redeem again",
						{
							duration: 6000,
						},
					);
				}
			}

			return result;
		},
		onSuccess: (_data, variables, context) => {
			toast.success(`Welcome ${variables.name}`, { id: context.toastId });
			// redirect
			window.location.href = `${env.NEXT_PUBLIC_DASHBOARD_URL}/dashboard`;
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
