import { accessSync, constants, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// A03: fresh setup must create rently_dev + rently_test with deterministic
// non-secret test env. This pins the committed template, the bootstrap
// script, and their parity with CI (which writes its own .env.test because
// the real file is untracked local-only and holds real secrets).
const repoRoot = path.resolve(
	fileURLToPath(new URL(".", import.meta.url)),
	"../../..",
);

const EXPECTED_TEST_ENV: Record<string, string> = {
	NODE_ENV: "test",
	DATABASE_URL:
		"postgresql://rently_db_user:rently_db_password@localhost:5432/rently_test",
	BETTER_AUTH_URL: "http://localhost:3000",
	NEXT_PUBLIC_SERVER_URL: "http://localhost:3000",
	NEXT_PUBLIC_WEB_URL: "http://localhost:3001",
	NEXT_PUBLIC_DASHBOARD_URL: "http://localhost:3002",
	NEXT_PUBLIC_TENANT_URL: "http://localhost:3003",
	NEXT_PUBLIC_ADMIN_URL: "http://localhost:3004",
};

function parseEnv(text: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const line of text.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eq = trimmed.indexOf("=");
		expect(eq, `malformed env line: ${trimmed}`).toBeGreaterThan(0);
		out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1).replace(/^"|"$/g, "");
	}
	return out;
}

describe("local database bootstrap (A03)", () => {
	it("ships a deterministic non-secret .env.test.example", () => {
		const example = readFileSync(
			path.join(repoRoot, "apps/server/.env.test.example"),
			"utf8",
		);
		expect(parseEnv(example)).toEqual(EXPECTED_TEST_ENV);
	});

	it("keeps the committed example committable (not git-ignored)", () => {
		const gitignore = readFileSync(
			path.join(repoRoot, "apps/server/.gitignore"),
			"utf8",
		);
		expect(gitignore).toMatch(/!\.env\.test\.example/);
	});

	it("keeps CI test env in parity with the committed example", () => {
		const ci = readFileSync(
			path.join(repoRoot, ".github/workflows/ci.yml"),
			"utf8",
		);
		const block = ci.slice(ci.indexOf("cat > apps/server/.env.test"));
		const start = block.indexOf("\n", block.indexOf("<<'EOF'"));
		const end = block.search(/\n\s*EOF/);
		const heredoc = block.slice(start, end);
		expect(parseEnv(heredoc)).toEqual(EXPECTED_TEST_ENV);
	});

	it("provides an executable localhost-guarded bootstrap script", () => {
		const scriptPath = path.join(repoRoot, "scripts/db-bootstrap-local.sh");
		accessSync(scriptPath, constants.X_OK);
		const script = readFileSync(scriptPath, "utf8");
		expect(script).toContain("rently_dev");
		expect(script).toContain("rently_test");
		expect(script).toContain("localhost");
		expect(script).toMatch(/Refusing|refus/i);
		// Never overwrites a developer's real .env.test.
		expect(script).toContain(".env.test.example");
	});

	it("wires db:bootstrap and documents the fresh-setup path", () => {
		const rootPkg = JSON.parse(
			readFileSync(path.join(repoRoot, "package.json"), "utf8"),
		) as { scripts: Record<string, string> };
		expect(rootPkg.scripts["db:bootstrap"]).toContain("db-bootstrap-local");
		const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");
		expect(readme).toContain("db:bootstrap");
		expect(readme).toContain(".env.test.example");
	});
});
