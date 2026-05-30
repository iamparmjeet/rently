import { env } from "@rently/env/web";

function getBaseDomain(): string {
	const hostname = new URL(env.NEXT_PUBLIC_APP_URL).hostname;
	return hostname.split(".").slice(-2).join(".");
}

// guard function
export function isTrustedCallbackUrl(url: string): boolean {
	// Relative urls ("/dashbaord")
	if (url.startsWith("/") && !url.startsWith("//")) return true;

	try {
		const parsed = new URL(url);
		const baseDomain = getBaseDomain();

		// reject non Http
		const isLocalHost = parsed.hostname === "localhost";
		if (!isLocalHost && parsed.protocol !== "https:") return false;

		// Allow exact same base and any subdomain
		return (
			parsed.hostname === baseDomain ||
			parsed.hostname.endsWith(`.${baseDomain}`) ||
			isLocalHost
		);
	} catch {
		return false;
	}
}
