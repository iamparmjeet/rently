import { betterFetch } from "@better-fetch/fetch";
import { hasSessionCookie } from "@rently/auth/cookies";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import { env } from "@rently/env/web";
import { evlogMiddleware } from "evlog/next";
import { type NextRequest, NextResponse } from "next/server";
import { AUTH_ROUTES } from "./constants/navigation";
import { isTrustedCallbackUrl } from "./lib/trusted-url";

type SessionResponse = {
	session: { id: string; expiresAt: string };
	user: { id: string; email: string; role?: string };
};

export default async function proxy(request: NextRequest) {
	evlogMiddleware();
	const { pathname } = request.nextUrl;

	// apps/web only has auth pages + landing page — no protected routes to guard.
	// The ONLY job for this proxy: if a logged-in user hits an auth route, redirect them
	// to the right app. Everything else passes through unconditionally.
	const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
	if (!isAuthRoute) return NextResponse.next();

	// Cross-app redirects are safe only for top-level document navigations.
	// Next client requests and browser prefetches use fetch/CORS semantics, so a
	// 307 to another origin would itself require CORS and fail before navigation.
	const isDocumentNavigation =
		request.headers.get("Sec-Fetch-Mode") === "navigate" &&
		request.headers.get("Sec-Fetch-Dest") === "document";
	if (!isDocumentNavigation) return NextResponse.next();

	// Fast-path: no cookie → unauthenticated user on login/register → let them through.
	if (!hasSessionCookie(request)) return NextResponse.next();
	// Cookie exists — verify with the server and redirect based on role.
	// WHY: We must server-verify here because:
	//   1. The cookie might be stale (expired session) → show the page, don't redirect
	//   2. We need the role to know WHICH app to redirect to
	const { data: session, error } = await betterFetch<SessionResponse>(
		"/api/auth/get-session",
		{
			baseURL: env.NEXT_PUBLIC_SERVER_URL,
			headers: { cookie: request.headers.get("cookie") ?? "" },
		},
	);

	// Stale/invalid cookie → let them use the auth page normally
	if (error || !session?.user) return NextResponse.next();

	const role = session.user.role;
	const callbackUrl = request.nextUrl.searchParams.get("callbackUrl");

	// Honour an explicit, trusted callbackUrl first — handles the "redirected from
	// tenant-portal / dashboard" case where proxy set callbackUrl before login.
	// GOTCHA: isTrustedCallbackUrl rejects external URLs — open redirect is not possible.
	if (callbackUrl && isTrustedCallbackUrl(callbackUrl)) {
		return NextResponse.redirect(new URL(callbackUrl, request.url));
	}

	// Role-aware redirect — each role has exactly one home.
	// GOTCHA: NEXT_PUBLIC_TENANT_URL is required in env schema (z.url()).
	// new URL("/tenant-portal", absoluteBase) correctly ignores the existing path.
	if (role === USER_ROLES.TENANT) {
		return NextResponse.redirect(
			new URL("/tenant-portal", env.NEXT_PUBLIC_TENANT_URL),
		);
	}

	// Owner (or unknown role) → dashboard
	return NextResponse.redirect(
		new URL("/dashboard", env.NEXT_PUBLIC_DASHBOARD_URL),
	);
}

export const config = {
	matcher: [
		"/((?!api|_next/static|_next/image|favicon.ico|api/auth|.*\\..*).*)",
	],
};
