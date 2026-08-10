import { ORPCError, os } from "@orpc/server";
import { auth } from "@rently/auth";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import type { AppContext } from "../context";

const base = os.$context<AppContext>();

// Anyone can call this
// uses - Public listing, health check, etc
export const publicProcedure = base;

const requireAuth = base.middleware(async ({ context, next }) => {
	const result = await auth.api.getSession({ headers: context.headers });

	if (!result?.user || !result?.session) {
		throw new ORPCError("UNAUTHORIZED", {
			message: "You must be logged in to access this resource.",
		});
	}

	return next({
		context: {
			user: result.user,
			session: result.session,
		},
	});
});

export const protectedProcedure = base.use(requireAuth);

const requireOwner = base.middleware(async ({ context, next }) => {
	// biome-ignore lint/suspicious/noExplicitAny: Better Auth additionalFields aren't typed on base User
	const role = (context as any).user.role as string | undefined;

	if (role !== USER_ROLES.OWNER) {
		throw new ORPCError("FORBIDDEN", {
			message: "Only property owners can perform this action.",
		});
	}

	return next({ context });
});

export const ownerProcedure = protectedProcedure.use(requireOwner);

const requireTenant = base.middleware(async ({ context, next }) => {
	// biome-ignore lint/suspicious/noExplicitAny: Better Auth additionalFields aren't typed on base User
	const role = (context as any).user.role as string | undefined;

	if (role !== USER_ROLES.TENANT) {
		throw new ORPCError("FORBIDDEN", {
			message: "Only tenants can perform this action.",
		});
	}

	return next({ context });
});

export const tenantProcedure = protectedProcedure.use(requireTenant);
