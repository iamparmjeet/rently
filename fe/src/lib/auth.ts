import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { env } from "#/env";
import { db } from "#/lib/db";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		// Must be "pg" for Postgres — matches the BE adapter
		provider: "pg",
	}),

	emailAndPassword: {
		enabled: true,
	},
	advanced: {
		cookiePrefix: "rently_session",
		cookieOptions: {
			httpOnly: true,
			secure: env.NODE_ENV === "production",
			sameSite: "lax",
		},
	},
	session: {
		expiresIn: 7 * 24 * 60 * 60, // 7 days
		cookieName: "rently_session",
	},

	secret: env.BETTER_AUTH_SECRET,

	// tanstackStartCookies handles SSR cookie forwarding correctly
	plugins: [tanstackStartCookies()],
});
