import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";
import { assertAllowedTestDatabaseUrl } from "./packages/db/src/test-db-guard";

config({
	path: "apps/server/.env.test",
	override: true,
});

assertAllowedTestDatabaseUrl(process.env.DATABASE_URL, "Tests");

export default defineConfig({
	oxc: {
		jsx: {
			runtime: "automatic",
		},
	},
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./apps/web/src", import.meta.url)),
		},
	},
	test: {
		environment: "node",
		include: ["packages/**/*.test.{ts,tsx}", "apps/**/*.test.{ts,tsx}"],
		exclude: ["**/node_modules/**", "**/.next/**"],
		testTimeout: 10_000,
	},
});
