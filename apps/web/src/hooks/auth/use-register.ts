import { env } from "@rently/env/web";
import type { RegisterFormType } from "@rently/validators";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NavigationLinkMap, toRoute } from "@/constants/navigation";
import { signUp } from "@/lib/auth-client";

export const useRegister = () => {
	const router = useRouter();

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
			return result;
		},
		onSuccess: (data, variables, context) => {
			toast.success(`Welcome ${variables.name}`, { id: context.toastId });
			router.push(toRoute(NavigationLinkMap.Dashboard.href));
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
