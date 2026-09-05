import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// A05: deployed configuration must match docs/Constraints.md — Aadhaar
// uploads off, production COOKIE_DOMAIN a bare domain. No env validation
// runs here; this pins the committed deployment files and schema defaults.
const repoRoot = path.resolve(
	fileURLToPath(new URL(".", import.meta.url)),
	"../../..",
);

describe("deployment safety gates (A05)", () => {
	it("keeps Aadhaar uploads off in the deployed worker config", () => {
		const wrangler = JSON.parse(
			readFileSync(path.join(repoRoot, "apps/server/wrangler.json"), "utf8"),
		) as { vars: Record<string, string> };
		expect(wrangler.vars.AADHAAR_UPLOADS_ENABLED).toBe("false");
	});

	it("keeps the deployed cookie domain a bare production domain", () => {
		const wrangler = JSON.parse(
			readFileSync(path.join(repoRoot, "apps/server/wrangler.json"), "utf8"),
		) as { vars: Record<string, string> };
		expect(wrangler.vars.COOKIE_DOMAIN).toBe(".parmjeetmishra.com");
	});

	it("defaults Aadhaar uploads to off in the env schema", () => {
		const schema = readFileSync(
			path.join(repoRoot, "packages/env/src/server.ts"),
			"utf8",
		);
		expect(schema).toMatch(
			/AADHAAR_UPLOADS_ENABLED:\s*z\.enum\(\["true",\s*"false"\]\)\.default\("false"\)/,
		);
	});
});
