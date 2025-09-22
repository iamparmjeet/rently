import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { DB_URL } from "@/constants/db-const";
import * as schema from "@/db/schema";

// import type { Environment } from "@/env";

const pool = new Pool({
  connectionString: DB_URL,
});

export const db = drizzle(pool, { schema, casing: "snake_case" });

export type Database = typeof db;
