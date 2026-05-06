import { env } from "@rently/env/web";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { NavigationLinkMap } from "@/constants/navigation";
import { signUp } from "@/lib/auth-client";
import type { RegisterFormType } from "@/types/auth-types";

export const useRegister = () => {
	const [isLoading, setIsLoading] = useState(false);
	const router = useRouter();
	const onSubmit = async (data: RegisterFormType) => {
		setIsLoading(true);

		const toastId = toast.loading("Creating your account...");

		await signUp.email(
			{
				email: data.email,
				password: data.password,
				name: data.name,
				phone: data.phone,
				callbackURL: `${env.NEXT_PUBLIC_SERVER_URL}/${NavigationLinkMap.Dashboard.href}`,
			},
			{
				onSuccess: (ctx) => {
					setIsLoading(false);
					toast.success(`Welcome ${data.name}`, {
						id: toastId,
					});
					router.push(NavigationLinkMap.Dashboard.href);
				},
				onError: (err) => {
					setIsLoading(false);
					toast.error(`Registration Error: ${err.error.message}`, {
						id: toastId,
					});
					console.error("Registration error OnErr:", err.error.message);
				},
			},
		);
	};
	return { onSubmit, isLoading };
};
