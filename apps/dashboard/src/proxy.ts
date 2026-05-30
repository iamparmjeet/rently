import { betterFetch } from "@better-fetch/fetch";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import { env } from "@rently/env/web";
import { evlogMiddleware } from "evlog/next";
import { type NextRequest, NextResponse } from "next/server";
import { PROTECTED_ROUTES } from "./constants/navigation";

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
function getWebLoginUrl(request: NextRequest): URL {
	const webBaseUrl = env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3001";
	const loginUrl = new URL("/login", webBaseUrl);

	loginUrl.searchParams.set("callbackUrl", request.url);
	return loginUrl;
}

// Main Function
export default async function proxy(request: NextRequest) {
	evlogMiddleware();
	const { pathname } = request.nextUrl;

	const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
		pathname.startsWith(route),
	);
	// Public Route
	if (!isProtectedRoute) return NextResponse.next();

	// fast path cookie check
	// Check cookie first
	const sessionCookie = request.cookies.get("rently.session_token");
	const hasSession = !!sessionCookie?.value;

	// Gate -1 - no session -> login
	if (!hasSession) {
		return NextResponse.redirect(getWebLoginUrl(request));
	}

	// Gate -2 - Already logged in, trying to reach login/register -> dashboard and session exist but verify with server
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

	if (error || !session.user) {
		return NextResponse.redirect(getWebLoginUrl(request));
	}

	// Gate-3 Role Check - Only runs when session exists on a protected route

	// Tenant Guard
	const role = session.user.role as string | undefined;

	if (role === USER_ROLES.TENANT) {
		const tenantPortalUrl = env.NEXT_PUBLIC_TENANT_URL
			? new URL("/tenant-portal", env.NEXT_PUBLIC_TENANT_URL)
			: new URL("tenant-portal", request.url);

		return NextResponse.redirect(tenantPortalUrl);
	}

	// Owner Guard
	if (role !== USER_ROLES.OWNER) {
		const webUrl = env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3001";
		return NextResponse.redirect(new URL("/", webUrl));
	}

	return NextResponse.next();
}

export const config = {
	runtime: "nodejs",
	matcher: [
		// "/api/:path*",
		"/((?!api|_next/static|_next/image|favicon.ico|api/auth|.*\\..*).*)",
	],
};
