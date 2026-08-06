import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({
	path: "apps/server/.env.test",
	override: true,
});

const databaseUrl = new URL(process.env.DATABASE_URL ?? "");

if (databaseUrl.pathname !== "/rently_test") {
	throw new Error(
		"Tests may run only against the rently_test database. Check apps/server/.env.test.",
	);
}

export default defineConfig({
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./apps/web/src", import.meta.url)),
		},
	},
	test: {
		environment: "node",
		include: ["packages/**/*.test.ts"],
		exclude: ["**/node_modules/**", "**/.next/**"],
		testTimeout: 10_000,
	},
});
