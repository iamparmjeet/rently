import { USER_ROLES } from "@rently/db/constants/user-roles";

export type AppRole = "owner" | "tenant";

export type AccessDecision =
	| { allow: true }
	| { allow: false; redirectTo: string };

export function isProtectedPath(
	pathname: string,
	protectedRoutes: readonly string[],
): boolean {
	return protectedRoutes.some((route) => pathname.startsWith(route));
}

// H08: single routing-layer decision shared by the dashboard and tenant
// proxies, so every financial route gets identical authentication and role
// handling on top of the owner/tenant-scoped APIs. verifiedRole is the
// server-verified session role (null when the session check fails); the
// cookie flag preserves the proxies' no-cookie fast path without a fetch.
export function resolveRouteAccess(input: {
	pathname: string;
	protectedRoutes: readonly string[];
	allowedRole: AppRole;
	hasSessionCookie: boolean;
	verifiedRole: string | null | undefined;
	loginUrl: string;
	callbackUrl: string;
	ownerHomeUrl: string;
	tenantHomeUrl: string;
	adminHomeUrl: string;
	webHomeUrl: string;
}): AccessDecision {
	if (!isProtectedPath(input.pathname, input.protectedRoutes)) {
		return { allow: true };
	}
	const login = `${input.loginUrl}?callbackUrl=${encodeURIComponent(input.callbackUrl)}`;
	if (!input.hasSessionCookie) {
		return { allow: false, redirectTo: login };
	}
	if (!input.verifiedRole) {
		return { allow: false, redirectTo: login };
	}
	if (input.verifiedRole === input.allowedRole) {
		return { allow: true };
	}
	if (input.verifiedRole === USER_ROLES.TENANT) {
		return { allow: false, redirectTo: input.tenantHomeUrl };
	}
	if (input.verifiedRole === USER_ROLES.OWNER) {
		return { allow: false, redirectTo: input.ownerHomeUrl };
	}
	if (input.verifiedRole === USER_ROLES.ADMIN) {
		return { allow: false, redirectTo: input.adminHomeUrl };
	}
	return { allow: false, redirectTo: input.webHomeUrl };
}
