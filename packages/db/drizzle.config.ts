import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

const isTestMigration = process.env.DRIZZLE_ENV === "test";

dotenv.config({
	path: isTestMigration
		? "../../apps/server/.env.test"
		: "../../apps/server/.env",
	override: isTestMigration,
});

const databaseUrl = new URL(process.env.DATABASE_URL ?? "");

if (isTestMigration && databaseUrl.pathname !== "/rently_test") {
	throw new Error(
		"Test migrations may run only against the rently_test database. Check apps/server/.env.test.",
	);
}

export default defineConfig({
	schema: "./src/schema",
	out: "./src/schema/migrations",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.DATABASE_URL || "",
	},
});
