import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { DB_URL } from "@/constants/db-const";
import * as schema from "@/db/schema";
import env from "@/env";

// import type { Environment } from "@/env";

const pool = new Pool({
	connectionString: DB_URL,
	ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: true } : false,
	max: 10,
	idleTimeoutMillis: 3000,
	connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
	console.error("Unexpected DB Pool Error", err);
});

export const db = drizzle(pool, { schema, casing: "snake_case" });

export type Database = typeof db;
