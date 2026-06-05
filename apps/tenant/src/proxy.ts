// apps/tenant/src/proxy.ts
import { betterFetch } from "@better-fetch/fetch";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import { env } from "@rently/env/web";
import { evlogMiddleware } from "evlog/next";
import { type NextRequest, NextResponse } from "next/server";

type SessionResponse = {
	session: { id: string; expiresAt: string };
	user: { id: string; email: string; role?: string };
};

const TENANT_PROTECTED_PATH = "/tenant-portal";

function getWebLoginUrl(request: NextRequest): URL {
	const webBaseUrl = env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3001";
	const loginUrl = new URL("/login", webBaseUrl);
	// WHY: Pass the FULL absolute URL as callbackUrl, not just pathname.
	// After login, use-login.ts will redirect back to this exact URL.
	loginUrl.searchParams.set("callbackUrl", request.url);
	return loginUrl;
}

export default async function proxy(request: NextRequest) {
	evlogMiddleware();
	const { pathname } = request.nextUrl;

	// /invite/[token] and /set-password are intentionally public — onboarding flow.
	if (!pathname.startsWith(TENANT_PROTECTED_PATH)) {
		return NextResponse.next();
	}

	// Fast-path: no cookie → send to web login.
	const sessionCookie = request.cookies.get("rently.session_token");
	if (!sessionCookie?.value) {
		return NextResponse.redirect(getWebLoginUrl(request));
	}

	// Verify session and role.
	const { data: session, error } = await betterFetch<SessionResponse>(
		"/api/auth/get-session",
		{
			baseURL: env.NEXT_PUBLIC_SERVER_URL,
			headers: { cookie: request.headers.get("cookie") ?? "" },
		},
	);

	// GOTCHA: Previously used `new URL("/login", request.url)` which resolved to
	// http://localhost:3002/login — apps/tenant has no /login route!
	// getWebLoginUrl() correctly uses NEXT_PUBLIC_WEB_URL.
	if (error || !session?.user) {
		return NextResponse.redirect(getWebLoginUrl(request));
	}

	const role = session.user.role as string | undefined;

	// Owner landed here by mistake → send them to their app.
	if (role === USER_ROLES.OWNER) {
		return NextResponse.redirect(
			new URL("/dashboard", env.NEXT_PUBLIC_DASHBOARD_URL),
		);
	}

	// Unknown role → web home.
	if (role !== USER_ROLES.TENANT) {
		return NextResponse.redirect(
			new URL("/", env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3001"),
		);
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		"/((?!api|_next/static|_next/image|favicon.ico|api/auth|.*\\..*).*)",
	],
};
