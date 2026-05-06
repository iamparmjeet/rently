import { db } from "@rently/db";
import type { Context, Next } from "hono";

export default async function dbMiddleware(c: Context, next: Next) {
	c.set("db", db);
	await next();
}

export type DbBindings = {
	Variables: {
		db: typeof db;
	};
};
