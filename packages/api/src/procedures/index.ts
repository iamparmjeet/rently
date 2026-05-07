import { ORPCError, os } from "@orpc/server";
import { auth } from "@rently/auth";
import type { AppContext } from "../context";
import { StatusPhrase } from "../utils";

const base = os.$context<AppContext>();

// Anyone can call this
// uses - Public listing, health check, etc
export const publicProcedure = base;

const requireAuth = base.middleware(async ({ context, next }) => {
	const result = await auth.api.getSession({ headers: context.headers });

	if (!result?.user || !result?.session) {
		throw (
			(new ORPCError(StatusPhrase.UNAUTHORIZED),
			{
				message: "You must be logged in to access this resource.",
			})
		);
	}

	return next({
		context: {
			user: result.user,
			session: result.session,
		},
	});
});

export const protectedProcedure = base.use(requireAuth);
