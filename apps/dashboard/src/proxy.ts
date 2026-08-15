import { betterFetch } from "@better-fetch/fetch";
import { hasSessionCookie } from "@rently/auth/cookies";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import { env } from "@rently/env/web";
import { evlogMiddleware } from "evlog/next";
import { type NextRequest, NextResponse } from "next/server";
import { PROTECTED_ROUTES } from "./constants/navigation";

type SessionResponse = {
	session: { id: string; expiresAt: string };
	user: { id: string; email: string; role?: string };
};

// WHY: Login lives on apps/web — all unauthenticated redirects from the dashboard
// must go there, not to a local /login route.
function getWebLoginUrl(request: NextRequest): URL {
	const webBaseUrl = env.NEXT_PUBLIC_WEB_URL;
	const loginUrl = new URL("/login", webBaseUrl);
	// Pass the full URL as callbackUrl so the user lands back here after login.
	loginUrl.searchParams.set("callbackUrl", request.url);
	return loginUrl;
}

export default async function proxy(request: NextRequest) {
	evlogMiddleware();
	const { pathname } = request.nextUrl;

	const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
		pathname.startsWith(route),
	);
	if (!isProtectedRoute) return NextResponse.next();

	const isPrefetch = request.headers.get("Next-Router-Prefetch") === "1";
	if (isPrefetch && !hasSessionCookie(request)) {
		return NextResponse.next();
	}

	// Fast-path: no cookie → redirect to web login immediately.
	if (!hasSessionCookie(request)) {
		return NextResponse.redirect(getWebLoginUrl(request));
	}

	// Cookie exists — verify with the server before trusting role.
	const serverUrl = env.NEXT_PUBLIC_SERVER_URL;
	const { data: session, error } = await betterFetch<SessionResponse>(
		"/api/auth/get-session",
		{
			baseURL: serverUrl,
			headers: { cookie: request.headers.get("cookie") ?? "" },
		},
	);

	// GOTCHA: session can be null (not just undefined) when no active session is found.
	// Use optional chaining — !session.user would throw TypeError on null.
	if (error || !session?.user) {
		return NextResponse.redirect(getWebLoginUrl(request));
	}

	const role = session.user.role as string | undefined;

	// GOTCHA: NEXT_PUBLIC_TENANT_URL is required (z.url(), not optional) in env schema.
	// No ternary fallback needed — T3 env throws at startup if it's missing.
	// The old fallback `new URL("tenant-portal", request.url)` was wrong in two ways:
	//   1. Missing leading slash → resolved relative to current path segment
	//   2. Same app origin → /tenant-portal on dashboard = infinite redirect loop
	if (role === USER_ROLES.TENANT) {
		return NextResponse.redirect(
			new URL("/tenant-portal", env.NEXT_PUBLIC_TENANT_URL),
		);
	}

	if (role === USER_ROLES.ADMIN) {
		return NextResponse.redirect(
			new URL("/dashboard", env.NEXT_PUBLIC_ADMIN_URL),
		);
	}

	// Owner passes through. Unknown role → back to web home.
	if (role !== USER_ROLES.OWNER) {
		return NextResponse.redirect(new URL("/", env.NEXT_PUBLIC_WEB_URL));
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		"/((?!api|_next/static|_next/image|favicon.ico|api/auth|.*\\..*).*)",
	],
};
