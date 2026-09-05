// A05: auth cookies must use the validated COOKIE_DOMAIN in production
// instead of deriving a domain from BETTER_AUTH_URL. Non-production keeps
// no explicit domain (localhost cookies break with one).
export function resolveCookieDomain(input: {
	isProduction: boolean;
	cookieDomain: string;
}): string | undefined {
	return input.isProduction ? input.cookieDomain : undefined;
}
