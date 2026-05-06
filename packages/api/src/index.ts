import { ORPCError, os } from "@orpc/server";

import type { Context } from "./context";

export const o = os.$context<Context>();

export const publicProcedure = o;

/*
  requireAuth Middleware
  1) Check if session exists
  2) Throws UNAUTHORIZED if not
  3) Calls next() with a NARROWED context

*/
const requireAuth = o.middleware(async ({ context, next }) => {
	if (!context.session?.user) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return next({
		context: {
			session: context.session,
			db: context.db,
		},
	});
});

export const protectedProcedure = publicProcedure.use(requireAuth);
