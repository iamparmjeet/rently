import { betterFetch } from "@better-fetch/fetch";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import proxy from "./proxy";

vi.mock("@better-fetch/fetch", () => ({
	betterFetch: vi.fn(),
}));

vi.mock("@rently/env/web", () => ({
	env: {
		NEXT_PUBLIC_SERVER_URL: "https://api.keyhq.test",
		NEXT_PUBLIC_WEB_URL: "https://keyhq.test",
		NEXT_PUBLIC_DASHBOARD_URL: "https://dashboard.keyhq.test",
		NEXT_PUBLIC_TENANT_URL: "https://tenant.keyhq.test",
	},
}));

vi.mock("evlog/next", () => ({
	evlogMiddleware: vi.fn(),
}));

describe("web proxy", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(betterFetch).mockResolvedValue({
			data: {
				session: { id: "session-1", expiresAt: "2099-01-01" },
				user: { id: "owner-1", email: "owner@example.com", role: "owner" },
			},
			error: null,
		} as never);
	});

	it.each([
		["Next-Router-Prefetch", "1"],
		["Next-Router-Prefetch", "2"],
		["Purpose", "prefetch"],
	])("does not redirect an authenticated prefetch marked by %s", async (header, value) => {
		const request = new NextRequest("https://keyhq.test/login", {
			headers: {
				cookie: "__Secure-rently.session_token=test-session",
				[header]: value,
			},
		});

		const response = await proxy(request);

		expect(response.status).toBe(200);
		expect(response.headers.get("x-middleware-next")).toBe("1");
		expect(betterFetch).not.toHaveBeenCalled();
	});

	it("still redirects an authenticated document request by role", async () => {
		const request = new NextRequest("https://keyhq.test/login", {
			headers: {
				cookie: "__Secure-rently.session_token=test-session",
			},
		});

		const response = await proxy(request);

		expect(response.status).toBe(307);
		expect(response.headers.get("location")).toBe(
			"https://dashboard.keyhq.test/dashboard",
		);
	});
});
