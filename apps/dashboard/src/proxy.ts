import { betterFetch } from "@better-fetch/fetch";
import { hasSessionCookie } from "@rently/auth/cookies";
import { resolveRouteAccess } from "@rently/auth/route-access";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import { env } from "@rently/env/web";
import { evlogMiddleware } from "evlog/next";
import { type NextRequest, NextResponse } from "next/server";
import { PROTECTED_ROUTES } from "./constants/navigation";

type SessionResponse = {
	session: { id: string; expiresAt: string };
	user: { id: string; email: string; role?: string };
};

export default async function proxy(request: NextRequest) {
	evlogMiddleware();
	const { pathname } = request.nextUrl;

	const isPrefetch = request.headers.get("Next-Router-Prefetch") === "1";
	const cookie = hasSessionCookie(request);
	if (isPrefetch && !cookie) {
		return NextResponse.next();
	}

	// Cookie exists — verify with the server before trusting role.
	// GOTCHA: session can be null (not just undefined) when no active session is found.
	// Use optional chaining — !session.user would throw TypeError on null.
	let verifiedRole: string | null = null;
	if (cookie) {
		const serverUrl = env.NEXT_PUBLIC_SERVER_URL;
		const { data: session, error } = await betterFetch<SessionResponse>(
			"/api/auth/get-session",
			{
				baseURL: serverUrl,
				headers: { cookie: request.headers.get("cookie") ?? "" },
			},
		);
		if (!error) verifiedRole = session?.user?.role ?? null;
	}

	// WHY: Login lives on apps/web — all unauthenticated redirects from the dashboard
	// must go there, not to a local /login route. The full URL rides as
	// callbackUrl so the user lands back here after login.
	// GOTCHA: NEXT_PUBLIC_TENANT_URL is required (z.url(), not optional) in env schema.
	// No ternary fallback needed — T3 env throws at startup if it's missing.
	const decision = resolveRouteAccess({
		pathname,
		protectedRoutes: PROTECTED_ROUTES,
		allowedRole: USER_ROLES.OWNER,
		hasSessionCookie: cookie,
		verifiedRole,
		loginUrl: new URL("/login", env.NEXT_PUBLIC_WEB_URL).toString(),
		callbackUrl: request.url,
		ownerHomeUrl: new URL("/dashboard", request.url).toString(),
		tenantHomeUrl: new URL(
			"/tenant-portal",
			env.NEXT_PUBLIC_TENANT_URL,
		).toString(),
		adminHomeUrl: new URL("/dashboard", env.NEXT_PUBLIC_ADMIN_URL).toString(),
		webHomeUrl: new URL("/", env.NEXT_PUBLIC_WEB_URL).toString(),
	});

	if (decision.allow) return NextResponse.next();
	return NextResponse.redirect(decision.redirectTo);
}

export const config = {
	matcher: [
		"/((?!api|_next/static|_next/image|favicon.ico|api/auth|.*\\..*).*)",
	],
};
