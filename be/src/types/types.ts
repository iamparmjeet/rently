import type { Session, User } from "better-auth";
import type { PinoLogger } from "hono-pino";
import type { Database } from "@/db";
import type { Environment } from "@/env";

export interface AppBindings {
  Bindings: Environment;
  Variables: {
    database: Database;
    logger: PinoLogger;
    user?: User;
    session: Session;
  };
}
