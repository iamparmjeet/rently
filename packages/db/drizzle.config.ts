import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

const isTestMigration = process.env.DRIZZLE_ENV === "test";
const isLocalMigration = process.env.DRIZZLE_ENV === "local";

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

if (
	isLocalMigration &&
	(databaseUrl.hostname !== "localhost" ||
		databaseUrl.pathname !== "/rently_dev")
) {
	throw new Error(
		"Local migrations may run only against localhost/rently_dev. Check db:migrate:local.",
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
