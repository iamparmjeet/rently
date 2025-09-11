import type { Context, Next } from "hono";
import auth from "@/lib/auth-cli";
import type { AppBindings } from "@/types/types";
import { StatusCode, StatusPhrase } from "@/utils";

const withAuth = () => async (c: Context<AppBindings>, next: Next) => {
  try {
    const result = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!result || !result.user || !result.session) {
      return c.json(
        {
          error: StatusPhrase.UNAUTHORIZED,
        },
        StatusCode.UNAUTHORIZED
      );
    }

    c.set("user", result.user);
    c.set("session", result.session);

    return next();
  } catch (error) {
    console.error("Auth Error", error);
    return c.json(
      {
        error: StatusPhrase.UNAUTHORIZED,
      },
      StatusCode.UNAUTHORIZED
    );
  }
};

export default withAuth;
