import { betterFetch } from "@better-fetch/fetch";
import { hasSessionCookie } from "@rently/auth/cookies";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import { env } from "@rently/env/web";
import { evlogMiddleware } from "evlog/next";
import { type NextRequest, NextResponse } from "next/server";

type SessionResponse = {
	session: { id: string; expiresAt: string };
	user: { id: string; email: string; role?: string };
};

function loginUrl(request: NextRequest): URL {
	const url = new URL("/login", env.NEXT_PUBLIC_WEB_URL);
	url.searchParams.set("callbackUrl", request.url);
	return url;
}

export default async function proxy(request: NextRequest) {
	evlogMiddleware();

	if (!hasSessionCookie(request)) {
		return NextResponse.redirect(loginUrl(request));
	}

	const { data: session, error } = await betterFetch<SessionResponse>(
		"/api/auth/get-session",
		{
			baseURL: env.NEXT_PUBLIC_SERVER_URL,
			headers: { cookie: request.headers.get("cookie") ?? "" },
		},
	);

	if (error || !session?.user) {
		return NextResponse.redirect(loginUrl(request));
	}

	switch (session.user.role) {
		case USER_ROLES.ADMIN:
			return NextResponse.next();
		case USER_ROLES.OWNER:
			return NextResponse.redirect(
				new URL("/dashboard", env.NEXT_PUBLIC_DASHBOARD_URL),
			);
		case USER_ROLES.TENANT:
			return NextResponse.redirect(
				new URL("/tenant-portal", env.NEXT_PUBLIC_TENANT_URL),
			);
		default:
			return NextResponse.redirect(new URL("/", env.NEXT_PUBLIC_WEB_URL));
	}
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
