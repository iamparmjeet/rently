import { evlogMiddleware } from "evlog/next";
import { type NextRequest, NextResponse } from "next/server";
import { NavigationLinkMap } from "./constants/navigation";

const PROTECTED_ROUTES = [NavigationLinkMap.Dashboard.href];

const AUTH_ROUTES = ["/login", "/register"];

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

	if (isProtectedRoute && !hasSession) {
		const loginUrl = new URL("/login", request.url);
		loginUrl.searchParams.set("callbackUrl", pathname);
		return NextResponse.redirect(loginUrl);
	}

	if (isAuthRoute && hasSession) {
		return NextResponse.redirect(
			new URL(NavigationLinkMap.Dashboard.href, request.url),
		);
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		"/api/:path*",
		"/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\..*).*)",
	],
};
