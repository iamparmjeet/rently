import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveCookieDomain } from "./cookie-domain";

// A05: production cookies use the validated COOKIE_DOMAIN; deriving the
// domain from BETTER_AUTH_URL is a second source of truth that can disagree
// with the deployed configuration.
describe("resolveCookieDomain", () => {
	it("returns the validated domain in production", () => {
		expect(
			resolveCookieDomain({
				isProduction: true,
				cookieDomain: ".parmjeetmishra.com",
			}),
		).toBe(".parmjeetmishra.com");
	});

	it("returns no explicit domain outside production", () => {
		expect(
			resolveCookieDomain({ isProduction: false, cookieDomain: "localhost" }),
		).toBeUndefined();
	});

	it("is wired into the auth configuration", () => {
		const index = readFileSync(
			path.join(fileURLToPath(new URL(".", import.meta.url)), "index.ts"),
			"utf8",
		);
		expect(index).toContain("resolveCookieDomain");
		expect(index).toContain("env.COOKIE_DOMAIN");
		expect(index).not.toContain("slice(-2)");
	});
});
