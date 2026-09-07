// H08 regression rationale: /combined-bill, /receipts/*, and /credit-notes/*
// rendered without any routing-layer guard (the dashboard proxy only knew
// navigation prefixes; the tenant proxy only knew /tenant-portal while the
// tenant receipt page lives at top-level /receipts/*). These tests pin the
// shared access decision — unauthenticated and wrong-role direct navigation
// — plus the route lists that feed it.
import { describe, expect, it } from "vitest";
import { isProtectedPath, resolveRouteAccess } from "./route-access";

const URLS = {
	loginUrl: "https://web.test/login",
	callbackUrl: "https://dash.test/receipts/abc",
	ownerHomeUrl: "https://dash.test/dashboard",
	tenantHomeUrl: "https://tenant.test/tenant-portal",
	adminHomeUrl: "https://admin.test/dashboard",
	webHomeUrl: "https://web.test/",
};

const DASHBOARD_FINANCIAL = ["/combined-bill", "/receipts", "/credit-notes"];

function dashboard(
	input: {
		pathname?: string;
		hasSessionCookie?: boolean;
		verifiedRole?: string | null;
	} = {},
) {
	return resolveRouteAccess({
		pathname: "/receipts/abc",
		protectedRoutes: ["/payments", ...DASHBOARD_FINANCIAL],
		allowedRole: "owner",
		hasSessionCookie: true,
		verifiedRole: "owner",
		...URLS,
		...input,
	});
}

function tenantReceipt(
	input: { hasSessionCookie?: boolean; verifiedRole?: string | null } = {},
) {
	return resolveRouteAccess({
		pathname: "/receipts/abc",
		protectedRoutes: ["/tenant-portal", "/receipts"],
		allowedRole: "tenant",
		hasSessionCookie: true,
		verifiedRole: "tenant",
		...URLS,
		...input,
	});
}

describe("resolveRouteAccess (H08)", () => {
	it("redirects unauthenticated direct navigation to login with a callback", () => {
		const decision = dashboard({ hasSessionCookie: false });
		expect(decision).toEqual({
			allow: false,
			redirectTo: `${URLS.loginUrl}?callbackUrl=${encodeURIComponent(URLS.callbackUrl)}`,
		});
	});

	it("redirects a cookie without a verified session to login", () => {
		expect(dashboard({ verifiedRole: null })).toEqual({
			allow: false,
			redirectTo: `${URLS.loginUrl}?callbackUrl=${encodeURIComponent(URLS.callbackUrl)}`,
		});
	});

	it("sends a tenant hitting a dashboard financial route to the tenant app", () => {
		expect(dashboard({ verifiedRole: "tenant" })).toEqual({
			allow: false,
			redirectTo: URLS.tenantHomeUrl,
		});
	});

	it("sends an admin hitting a dashboard financial route to the admin app", () => {
		expect(dashboard({ verifiedRole: "admin" })).toEqual({
			allow: false,
			redirectTo: URLS.adminHomeUrl,
		});
	});

	it("lets the owner through to a dashboard financial route", () => {
		expect(dashboard()).toEqual({ allow: true });
	});

	it("redirects an owner hitting a tenant receipt to the dashboard", () => {
		expect(tenantReceipt({ verifiedRole: "owner" })).toEqual({
			allow: false,
			redirectTo: URLS.ownerHomeUrl,
		});
	});

	it("redirects unauthenticated navigation to a tenant receipt to login", () => {
		const decision = tenantReceipt({ hasSessionCookie: false });
		expect(decision.allow).toBe(false);
		if (!decision.allow) {
			expect(
				decision.redirectTo.startsWith(`${URLS.loginUrl}?callbackUrl=`),
			).toBe(true);
		}
	});

	it("lets the tenant through to their own receipt", () => {
		expect(tenantReceipt()).toEqual({ allow: true });
	});

	it("sends an unknown role to the web home", () => {
		expect(dashboard({ verifiedRole: "ghost" })).toEqual({
			allow: false,
			redirectTo: URLS.webHomeUrl,
		});
	});

	it("leaves public paths alone regardless of session", () => {
		expect(
			resolveRouteAccess({
				pathname: "/login",
				protectedRoutes: ["/payments"],
				allowedRole: "owner",
				hasSessionCookie: false,
				verifiedRole: null,
				...URLS,
			}),
		).toEqual({ allow: true });
	});
});

describe("isProtectedPath (H08)", () => {
	it("covers parameterized financial routes by prefix", () => {
		for (const route of DASHBOARD_FINANCIAL) {
			expect(isProtectedPath(`${route}/abc123`, DASHBOARD_FINANCIAL)).toBe(
				true,
			);
		}
		expect(isProtectedPath("/receipts/abc123", DASHBOARD_FINANCIAL)).toBe(true);
	});

	it("does not match sibling prefixes", () => {
		expect(isProtectedPath("/receipt", DASHBOARD_FINANCIAL)).toBe(false);
		expect(isProtectedPath("/login", DASHBOARD_FINANCIAL)).toBe(false);
	});
});
