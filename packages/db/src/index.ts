// db/index.ts

import { neon } from "@neondatabase/serverless";
import { env } from "@rently/env/server";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// ═══════════════════════════════════════════════════
// EXPLICIT RETURN TYPE — breaks the inference chain
// ═══════════════════════════════════════════════════

// Drizzle's internal type (simplified)
type NeonDatabase = ReturnType<typeof drizzleNeon>;
type PgDatabase = ReturnType<typeof drizzlePg>;

// Union or common interface — they share the same query API surface
export type Database = PgDatabase | NeonDatabase;

// Or if you want stricter: they're structurally compatible
// export type Database = PgDatabase;

export function createDb(): Database {
	const url = env.DATABASE_URL;

	if (isNeonUrl(url) || env.USE_NEON === "true") {
		const sql = neon(url);
		// Explicit call — no ambiguity
		return drizzleNeon(sql, { schema, casing: "snake_case" });
	}

	const pool = new Pool({
		connectionString: url,
		ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: true } : false,
		max: 10,
		idleTimeoutMillis: 3000,
		connectionTimeoutMillis: 5000,
	});

	pool.on("error", (err) => {
		console.error("[DB] Unexpected pool error:", err);
	});

	// Explicit call — compiler knows this is pg variant
	return drizzlePg(pool, { schema, casing: "snake_case" });
}

function isNeonUrl(url: string): boolean {
	return url.includes("neon.tech") || url.includes("aws.neon.tech");
}

export const db = createDb();
