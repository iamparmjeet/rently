// apps/tenant/src/proxy.ts
import { betterFetch } from "@better-fetch/fetch";
import { hasSessionCookie } from "@rently/auth/cookies";
import { resolveRouteAccess } from "@rently/auth/route-access";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import { env } from "@rently/env/web";
import { evlogMiddleware } from "evlog/next";
import { type NextRequest, NextResponse } from "next/server";
import { TENANT_PROTECTED_ROUTES } from "./constants/navigation";

type SessionResponse = {
	session: { id: string; expiresAt: string };
	user: { id: string; email: string; role?: string };
};

export default async function proxy(request: NextRequest) {
	evlogMiddleware();
	const { pathname } = request.nextUrl;

	// /invite/[token] and /set-password are intentionally public — onboarding flow.
	// H08: receipt documents live at top-level /receipts/* and are guarded
	// through TENANT_PROTECTED_ROUTES, not just the portal prefix.
	const cookie = hasSessionCookie(request);

	// Verify session and role (only when a cookie could carry one).
	// GOTCHA: session can be null (not just undefined) when no active session
	// is found — use optional chaining.
	let verifiedRole: string | null = null;
	if (cookie) {
		const { data: session, error } = await betterFetch<SessionResponse>(
			"/api/auth/get-session",
			{
				baseURL: env.NEXT_PUBLIC_SERVER_URL,
				headers: { cookie: request.headers.get("cookie") ?? "" },
			},
		);
		if (!error) verifiedRole = session?.user?.role ?? null;
	}

	const webBase = env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3001";
	const decision = resolveRouteAccess({
		pathname,
		protectedRoutes: TENANT_PROTECTED_ROUTES,
		allowedRole: USER_ROLES.TENANT,
		hasSessionCookie: cookie,
		verifiedRole,
		loginUrl: new URL("/login", webBase).toString(),
		callbackUrl: request.url,
		ownerHomeUrl: new URL(
			"/dashboard",
			env.NEXT_PUBLIC_DASHBOARD_URL,
		).toString(),
		tenantHomeUrl: new URL("/tenant-portal", request.url).toString(),
		adminHomeUrl: new URL("/dashboard", env.NEXT_PUBLIC_ADMIN_URL).toString(),
		webHomeUrl: new URL("/", webBase).toString(),
	});

	if (decision.allow) return NextResponse.next();
	return NextResponse.redirect(decision.redirectTo);
}

export const config = {
	matcher: [
		"/((?!api|_next/static|_next/image|favicon.ico|api/auth|.*\\..*).*)",
	],
};
