import { type Database, db } from "@rently/db";
import type { Context as HonoContext } from "hono";

export type CreateContextOptions = {
	context: HonoContext;
};

export async function createContext({ context }: { context: HonoContext }) {
	return {
		db: db as Database,
		headers: context.req.raw.headers,
	};
}

export type AppContext = Awaited<ReturnType<typeof createContext>>;
