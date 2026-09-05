import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	assertAllowedTestDatabaseUrl,
	isAllowedTestDatabaseUrl,
} from "./test-db-guard";

// A04: destructive tests/migrations must require BOTH the rently_test name
// AND an approved host. The old pathname-only check let a remote database
// named rently_test through.
const repoRoot = path.resolve(
	fileURLToPath(new URL(".", import.meta.url)),
	"../../..",
);

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("isAllowedTestDatabaseUrl", () => {
	it("accepts local Docker URLs for rently_test", () => {
		expect(
			isAllowedTestDatabaseUrl(
				"postgresql://rently_db_user:rently_db_password@localhost:5432/rently_test",
			),
		).toBe(true);
		expect(
			isAllowedTestDatabaseUrl(
				"postgresql://rently_db_user:rently_db_password@127.0.0.1:5432/rently_test",
			),
		).toBe(true);
	});

	it("rejects wrong database names on localhost", () => {
		expect(
			isAllowedTestDatabaseUrl(
				"postgresql://rently_db_user:rently_db_password@localhost:5432/rently_dev",
			),
		).toBe(false);
		expect(
			isAllowedTestDatabaseUrl(
				"postgresql://rently_db_user:rently_db_password@localhost:5432/rently_db",
			),
		).toBe(false);
	});

	it("rejects remote hosts even when named rently_test", () => {
		expect(
			isAllowedTestDatabaseUrl(
				"postgresql://user:password@ep-example.ap-southeast-1.aws.neon.tech/rently_test",
			),
		).toBe(false);
		expect(
			isAllowedTestDatabaseUrl(
				"postgresql://user:password@db.example.com:5432/rently_test",
			),
		).toBe(false);
	});

	it("rejects hostname lookalikes and malformed values", () => {
		expect(
			isAllowedTestDatabaseUrl(
				"postgresql://user:password@localhost.evil.com/rently_test",
			),
		).toBe(false);
		expect(isAllowedTestDatabaseUrl(undefined)).toBe(false);
		expect(isAllowedTestDatabaseUrl("")).toBe(false);
		expect(isAllowedTestDatabaseUrl("not-a-url")).toBe(false);
	});

	it("accepts only explicitly allowlisted extra hosts", () => {
		vi.stubEnv("RENTRY_TEST_EXTRA_HOSTS", "ep-test-123.aws.neon.tech");
		expect(
			isAllowedTestDatabaseUrl(
				"postgresql://user:password@ep-test-123.aws.neon.tech/rently_test",
			),
		).toBe(true);
		expect(
			isAllowedTestDatabaseUrl(
				"postgresql://user:password@ep-other.aws.neon.tech/rently_test",
			),
		).toBe(false);
		expect(
			isAllowedTestDatabaseUrl(
				"postgresql://user:password@ep-test-123.aws.neon.tech/rently_dev",
			),
		).toBe(false);
	});
});

describe("assertAllowedTestDatabaseUrl", () => {
	it("throws for a remote rently_test impostor", () => {
		expect(() =>
			assertAllowedTestDatabaseUrl(
				"postgresql://user:password@ep-example.ap-southeast-1.aws.neon.tech/rently_test",
				"test",
			),
		).toThrow(/refusing/i);
	});
});

describe("guard consumers (A04)", () => {
	it("routes vitest and drizzle test guards through the shared helper", () => {
		for (const file of ["vitest.config.ts", "packages/db/drizzle.config.ts"]) {
			const text = readFileSync(path.join(repoRoot, file), "utf8");
			expect(text).toContain("test-db-guard");
		}
	});
});
