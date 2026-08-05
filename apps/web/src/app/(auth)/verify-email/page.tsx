import { env } from "@rently/env/web";
import { VerificationRequired } from "@/components/auth/verification-required";
import { isTrustedCallbackUrl } from "@/lib/trusted-url";

export default async function VerifyEmailPage({
	searchParams,
}: {
	searchParams: Promise<{ email?: string; callbackUrl?: string }>;
}) {
	const { email, callbackUrl } = await searchParams;

	const safeCallbackUrl =
		callbackUrl && isTrustedCallbackUrl(callbackUrl) ? callbackUrl : undefined;

	const verificationCallbackUrl = new URL("/callback", env.NEXT_PUBLIC_WEB_URL);

	if (safeCallbackUrl) {
		verificationCallbackUrl.searchParams.set("callbackUrl", safeCallbackUrl);
	}

	return (
		<VerificationRequired
			email={email}
			verificationCallbackUrl={verificationCallbackUrl.toString()}
			safeCallbackUrl={safeCallbackUrl}
		/>
	);
}
