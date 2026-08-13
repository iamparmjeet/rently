import { betterFetch } from "@better-fetch/fetch";
import { hasSessionCookie } from "@rently/auth/cookies";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import proxy from "./proxy";

vi.mock("@better-fetch/fetch", () => ({
	betterFetch: vi.fn(),
}));

vi.mock("@rently/auth/cookies", () => ({
	hasSessionCookie: vi.fn(),
}));

vi.mock("@rently/env/web", () => ({
	env: {
		NEXT_PUBLIC_SERVER_URL: "https://api.keyhq.test",
		NEXT_PUBLIC_WEB_URL: "https://keyhq.test",
		NEXT_PUBLIC_DASHBOARD_URL: "https://dashboard.keyhq.test",
		NEXT_PUBLIC_TENANT_URL: "https://tenant.keyhq.test",
		NEXT_PUBLIC_ADMIN_URL: "https://admin.keyhq.test",
	},
}));

vi.mock("evlog/next", () => ({
	evlogMiddleware: vi.fn(),
}));

function request() {
	return new NextRequest("https://admin.keyhq.test/users", {
		headers: { cookie: "__Secure-rently.session_token=test-session" },
	});
}

function mockSession(role?: string) {
	vi.mocked(betterFetch).mockResolvedValue({
		data: {
			session: { id: "session-1", expiresAt: "2099-01-01" },
			user: { id: "user-1", email: "user@example.com", role },
		},
		error: null,
	} as never);
}

describe("admin proxy", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(hasSessionCookie).mockReturnValue(true);
	});

	it("sends unauthenticated requests to the web login with a callback", async () => {
		vi.mocked(hasSessionCookie).mockReturnValue(false);
		const response = await proxy(request());

		expect(response.status).toBe(307);
		expect(response.headers.get("location")).toBe(
			"https://keyhq.test/login?callbackUrl=https%3A%2F%2Fadmin.keyhq.test%2Fusers",
		);
		expect(betterFetch).not.toHaveBeenCalled();
	});

	it("allows only the admin role", async () => {
		mockSession("admin");
		const response = await proxy(request());

		expect(response.status).toBe(200);
		expect(response.headers.get("x-middleware-next")).toBe("1");
	});

	it.each([
		["owner", "https://dashboard.keyhq.test/dashboard"],
		["tenant", "https://tenant.keyhq.test/tenant-portal"],
		["unknown", "https://keyhq.test/"],
		[undefined, "https://keyhq.test/"],
	])("redirects the %s role away from admin", async (role, expectedUrl) => {
		mockSession(role);
		const response = await proxy(request());

		expect(response.status).toBe(307);
		expect(response.headers.get("location")).toBe(expectedUrl);
	});

	it("rejects an invalid server-side session even when a cookie exists", async () => {
		vi.mocked(betterFetch).mockResolvedValue({
			data: null,
			error: {},
		} as never);
		const response = await proxy(request());

		expect(response.status).toBe(307);
		expect(response.headers.get("location")).toContain(
			"https://keyhq.test/login?callbackUrl=",
		);
	});
});
