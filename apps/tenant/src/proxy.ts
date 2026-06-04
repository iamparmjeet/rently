import { betterFetch } from "@better-fetch/fetch";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import { env } from "@rently/env/web";
import { evlogMiddleware } from "evlog/next";
import { type NextRequest, NextResponse } from "next/server";

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

const TENANT_PROTECTED_PATH = "/tenant-portal";

// Helper — keeps the redirect construction readable and typed
function getWebLoginUrl(request: NextRequest): URL {
	const webBaseUrl = env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3001";
	const loginUrl = new URL("/login", webBaseUrl);
	loginUrl.searchParams.set("callbackUrl", request.url);
	return loginUrl;
}

export default async function proxy(request: NextRequest) {
	evlogMiddleware();
	const { pathname } = request.nextUrl;

	// Only /tenant-portal (and sub-paths) require auth.
	// /invite/[token] and /set-password are public — tenants complete onboarding there.

	if (!pathname.startsWith(TENANT_PROTECTED_PATH)) {
		return NextResponse.next();
	}

	// Check cookie first
	const sessionCookie = request.cookies.get("rently.session_token");
	const hasSession = !!sessionCookie?.value;

	// Gate -1 - no session -> login
	if (!hasSession) {
		return NextResponse.redirect(getWebLoginUrl(request));
	}

	// Gate -2 - session exists → verify + role check
	const { data: session, error } = await betterFetch<SessionResponse>(
		"/api/auth/get-session",
		{
			baseURL: env.NEXT_PUBLIC_SERVER_URL,
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

	// Gate-3 Role Check - Only runs when session exists on a protected route
	// Tenant Guard
	const role = session.user.role as string | undefined;

	// Owner Guard
	if (role === USER_ROLES.OWNER) {
		const dashboardUrl = env.NEXT_PUBLIC_DASHBOARD_URL
			? new URL("/dashboard", env.NEXT_PUBLIC_DASHBOARD_URL)
			: new URL("/", env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3001");
		return NextResponse.redirect(dashboardUrl);
	}

	if (role !== USER_ROLES.TENANT) {
		const webUrl = env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3001";
		return NextResponse.redirect(new URL("/", webUrl));
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
