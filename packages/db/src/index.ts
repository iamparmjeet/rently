import { neon } from "@neondatabase/serverless";
import { env } from "@rently/env/server";
import { drizzle as drizzleNeonHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool as PgPool } from "pg";
import * as schema from "./schema";

export type NeonHttpDatabase = ReturnType<typeof drizzleNeonHttp>;
type PgDatabase = ReturnType<typeof drizzlePg>;
export type Database = NeonHttpDatabase | PgDatabase;

/**
 * neon-http intentionally does not implement callback transactions. Its batch
 * API sends a non-interactive group of queries to Neon as one transaction.
 */
export function supportsDatabaseBatch(
	database: Database,
): database is NeonHttpDatabase {
	return (
		"batch" in database &&
		typeof (database as { batch?: unknown }).batch === "function"
	);
}

export function createDb(): Database {
	const url = env.DATABASE_URL;

	if (isNeonUrl(url) || env.USE_NEON === "true") {
		// WHY neon-http not neon-serverless/Pool:
		// CF Workers is stateless. The WebSocket Pool creates persistent connections
		// that span request lifecycles, triggering CF's cross-request promise warning
		// and causing cold-start crashes. HTTP mode is one request per query — no
		// persistent connection to manage, no race conditions.
		const sql = neon(url);
		return drizzleNeonHttp(sql, { schema, casing: "snake_case" });
	}

	// Local Docker Postgres — no change needed
	const pool = new PgPool({
		connectionString: url,
		ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: true } : false,
		max: 10,
		idleTimeoutMillis: 3000,
		connectionTimeoutMillis: 5000,
	});

	pool.on("error", (err) => {
		console.error("[DB] Unexpected pool error:", err);
	});

	return drizzlePg(pool, { schema, casing: "snake_case" });
}

function isNeonUrl(url: string): boolean {
	return url.includes("neon.tech") || url.includes("aws.neon.tech");
}

export const db = createDb();
