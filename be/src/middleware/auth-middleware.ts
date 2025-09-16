import type { Context, Next } from "hono";
import { auth } from "@/lib/auth";
import type { ExtendedUser } from "@/types/types";
import { StatusCode, safeError, sendError, unauthorized } from "@/utils";

const withAuth = () => async (c: Context, next: Next) => {
  try {
    // const auth = createAuth(db);
    const result = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!result || !result.user || !result.session) {
      return unauthorized(c);
    }

    c.set("user", result.user as ExtendedUser);
    c.set("session", result.session);

    return next();
  } catch (error) {
    console.error("Auth Error", safeError(error));
    return sendError(c, "unauthorized", StatusCode.UNAUTHORIZED);
  }
};

export default withAuth;
