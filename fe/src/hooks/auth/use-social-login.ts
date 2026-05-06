import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { NavigationLinkMap } from "@/constants/navigation";
import { env } from "@/env";
import { signIn } from "@/lib/auth-client";
import type { SocialProvider } from "@/types/auth-types";

export const useSocialLogin = () => {
	const [loadingProvider, setLoadingProvider] = useState<SocialProvider | null>(
		null,
	);
	const searchParams = useSearchParams();

	useEffect(() => {
		const error = searchParams.get("error");
		const errorDescription = searchParams.get("error_description");

		if (!error) return;

		const messages: Record<string, string> = {
			access_denied: "Sign in was cancelled.", // user hit cancel
			temporarily_unavailable: "Provider unavailable, try again.",
			server_error: "Something went wrong with the provider.",
		};

		toast.error(messages[error] ?? errorDescription ?? "Sign in failed.");

		// Clean URL without reload
		window.history.replaceState({}, "", window.location.pathname);
	}, [searchParams]);

	const handleSocialLogin = async (provider: SocialProvider) => {
		setLoadingProvider(provider);
		const toastId = toast.loading(`Connecting with ${provider}...`);

		await signIn.social(
			{
				provider,
				callbackURL: `${env.NEXT_PUBLIC_APP_URL}/${NavigationLinkMap.Dashboard.href}`,
			},
			{
				onError: (err) => {
					setLoadingProvider(null);
					toast.error(err.error.message, { id: toastId });
				},
			},
		);
	};

	return { handleSocialLogin, loadingProvider };
};
