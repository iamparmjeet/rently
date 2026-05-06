import type { Session, User } from "better-auth";
import type { Context } from "hono";
import type { PinoLogger } from "hono-pino";
import type { UserRole } from "@/constants/user-roles";
import type { db } from "@/db";
import type { Environment } from "@/env";

export interface ExtendedUser extends User {
  role: UserRole;
}

export interface AppBindings {
  Bindings: Environment;
  Variables: {
    db: typeof db;
    logger: PinoLogger;
    user: ExtendedUser;
    session: Session;
  };
}

export type Ctx = Context<AppBindings>;
