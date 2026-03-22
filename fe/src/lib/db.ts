import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/env";

function builDbUrl(): string {
	if (env.DB_URL) return env.DB_URL;
	return `postgresql://${env.DB_USER}:${env.DB_PASSWORD}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`;
}

const pool = new Pool({
	connectionString: builDbUrl(),
	ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: true } : false,
	max: 5,
	idleTimeoutMillis: 30_000,
	connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
	console.error("Unexpected FE DB Pool error", err);
});

export const db = drizzle(pool);
