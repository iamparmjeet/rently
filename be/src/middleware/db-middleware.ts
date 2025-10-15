import type { Context, Next } from "hono";
import { db } from "@/db";

export default async function dbMiddleware(c: Context, next: Next) {
  c.set("db", db);
  await next();
}

export type DbBindings = {
  Variables: {
    db: typeof db;
  };
};
