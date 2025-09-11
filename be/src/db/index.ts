import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema/schema";
import type { Environment } from "@/env";

export function createDB(env: Environment) {
  const db = drizzle(env.CF_D1_DB_ID, { schema, casing: "snake_case" });
  // console.log("db", db);
  return { db };
}

export type Database = ReturnType<typeof createDB>["db"];
