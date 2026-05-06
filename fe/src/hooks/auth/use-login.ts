import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { NavigationLinkMap } from "@/constants/navigation";
import { signIn } from "@/lib/auth-client";
import type { LoginFormType } from "@/types/auth-types";

export const useLogin = () => {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);

	const onSubmit = async (data: LoginFormType) => {
		setIsLoading(true);
		const toastId = toast.loading("Signing in...");

		await signIn.email(
			{
				email: data.email,
				password: data.password,
			},
			{
				onSuccess: () => {
					setIsLoading(false);
					toast.success("Welcome back", { id: toastId });
					router.push(NavigationLinkMap.Dashboard.href);
				},
				onError: (err) => {
					setIsLoading(false);
					toast.error(err.error.message, { id: toastId });
				},
			},
		);
	};
	return { onSubmit, isLoading };
};
