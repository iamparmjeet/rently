// packages/db/src/index.ts

import { neonConfig, Pool } from "@neondatabase/serverless"; // ✅ Pool, not neon
import { env } from "@rently/env/server";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless"; // ✅ neon-serverless, not neon-http
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool as PgPool } from "pg";
import * as schema from "./schema";

type NeonDatabase = ReturnType<typeof drizzleNeon>;
type PgDatabase = ReturnType<typeof drizzlePg>;
export type Database = NeonDatabase | PgDatabase;

export function createDb(): Database {
	const url = env.DATABASE_URL;

	if (isNeonUrl(url) || env.USE_NEON === "true") {
		// Bun has global WebSocket — set it so the Neon driver can use it
		// In Node.js you'd need: import ws from "ws"; neonConfig.webSocketConstructor = ws
		neonConfig.webSocketConstructor = WebSocket;

		const pool = new Pool({ connectionString: url });
		return drizzleNeon(pool, { schema, casing: "snake_case" });
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
