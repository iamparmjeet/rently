import { betterFetch } from "@better-fetch/fetch";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import { env } from "@rently/env/web";
import { evlogMiddleware } from "evlog/next";
import { type NextRequest, NextResponse } from "next/server";
import {
	AUTH_ROUTES,
	NavigationLinkMap,
	PROTECTED_ROUTES,
} from "./constants/navigation";
import type { RedirectErrorKey } from "./constants/redirect-errors";
import { isTrustedCallbackUrl } from "./lib/trusted-url";

const TENANT_PORTAL = "/tenant-portal";

type SessionResponse = {
	session: {
		id: string;
		expiresAt: string;
	};
	user: {
		id: string;
		email: string;
		role?: string;
	};
};

// Helper — keeps the redirect construction readable and typed
function redirectWithError(
	base: string,
	request: NextRequest,
	error: RedirectErrorKey,
): NextResponse {
	const url = new URL(base, request.url);
	url.searchParams.set("error", error);
	return NextResponse.redirect(url);
}

export default async function proxy(request: NextRequest) {
	evlogMiddleware();
	const { pathname } = request.nextUrl;

	const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
		pathname.startsWith(route),
	);
	const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

	// Check cookie first
	const sessionCookie = request.cookies.get("rently.session_token");
	const hasSession = !!sessionCookie?.value;

	// Gate -1 - no session -> login
	if (isProtectedRoute && !hasSession) {
		const loginUrl = new URL("/login", request.url);
		loginUrl.searchParams.set("callbackUrl", pathname);
		return NextResponse.redirect(loginUrl);
	}

	// Gate -2 - Already logged in, trying to reach login/register -> dashboard
	if (isAuthRoute && hasSession) {
		const callbackUrl = request.nextUrl.searchParams.get("callbackUrl");
		if (callbackUrl && isTrustedCallbackUrl(callbackUrl)) {
			return NextResponse.redirect(new URL(callbackUrl, request.url));
		}
		return NextResponse.redirect(
			new URL(`${env.NEXT_PUBLIC_DASHBOARD_URL}/dashboard`, request.url),
		);
	}

	// Gate-3 Role Check - Only runs when session exists on a protected route
	if (isProtectedRoute && hasSession) {
		const serverUrl = env.NEXT_PUBLIC_SERVER_URL;

		const { data: session, error } = await betterFetch<SessionResponse>(
			"/api/auth/get-session",
			{
				baseURL: serverUrl,
				headers: {
					cookie: request.headers.get("cookie") ?? "",
				},
			},
		);

		// Cookie exits but session is ivalid/expired
		if (error || !session?.user) {
			const loginUrl = new URL("/login", request.url);
			loginUrl.searchParams.set("callbackUrl", pathname);
			return NextResponse.redirect(loginUrl);
		}

		const role = session.user.role as string | undefined;

		// Tenant Guard
		if (role === USER_ROLES.TENANT) {
			return redirectWithError(TENANT_PORTAL, request, "unauthorized_access");
		}

		// Owner Guard
		if (role !== USER_ROLES.OWNER) {
			return NextResponse.redirect(
				new URL(NavigationLinkMap.Dashboard.href, request.url),
			);
		}
	}

	return NextResponse.next();
}

export const config = {
	// runtime: "nodejs",
	matcher: [
		// "/api/:path*",
		"/((?!api|_next/static|_next/image|favicon.ico|api/auth|.*\\..*).*)",
	],
};
