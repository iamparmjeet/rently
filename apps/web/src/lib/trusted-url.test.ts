import { describe, expect, it } from "vitest";
import { isTrustedCallbackUrl } from "./trusted-url";

describe("isTrustedCallbackUrl", () => {
	it("allows relative paths and KeyHQ application URLs", () => {
		expect(isTrustedCallbackUrl("/dashboard")).toBe(true);
		expect(
			isTrustedCallbackUrl("http://localhost:3002/properties?view=active"),
		).toBe(true);
	});

	it("rejects external and protocol-relative URLs", () => {
		expect(isTrustedCallbackUrl("https://evil.example")).toBe(false);
		expect(isTrustedCallbackUrl("//evil.example")).toBe(false);
		expect(isTrustedCallbackUrl("javascript:alert(1)")).toBe(false);
	});
});
