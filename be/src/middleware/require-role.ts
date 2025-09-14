import type { Context, Next } from "hono";
import type { UserRole } from "@/constants/user-roles";
import type { AppBindings } from "@/types/types";
import { forbidden } from "@/utils";

export default function requireRole(role: UserRole) {
  return async (c: Context<AppBindings>, next: Next) => {
    const user = c.get("user");
    console.log("userfromrole", user);

    if (!user || user.role !== role) {
      return forbidden(c);
    }
    return next();
  };
}
