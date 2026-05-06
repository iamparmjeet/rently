import type { db } from "@rently/db";
import type { UserRole } from "@rently/db/constants/user-roles";
import type { env } from "@rently/env/server";
import type { Session, User } from "better-auth";
import type { EvlogVariables } from "evlog/hono";
import type { Context } from "hono";

export interface ExtendedUser extends User {
	role: UserRole;
	phone?: string;
}

export interface AppBindings extends EvlogVariables {
	Bindings: typeof env;
	Variables: {
		db: typeof db;
		user: ExtendedUser;
		session: Session;
	} & EvlogVariables["Variables"];
}

export type Ctx = Context<AppBindings>;
