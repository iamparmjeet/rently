import type { Session, User } from "better-auth";
import type { PinoLogger } from "hono-pino";
import type { UserRole } from "@/constants/user-roles";
import type { Database } from "@/db";
import type { Environment } from "@/env";

export interface ExtendedUser extends User {
  role: UserRole;
}

export interface AppBindings {
  Bindings: Environment;
  Variables: {
    db: Database;
    logger: PinoLogger;
    user?: ExtendedUser;
    session: Session;
  };
}
