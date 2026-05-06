import { createDb } from "@rently/db";
import * as schema from "@rently/db/schema/auth";
import { env } from "@rently/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI } from "better-auth/plugins";
import { USER_ROLE_VALUES } from "./constants/user-roles";

export function createAuth() {
	const db = createDb();

	return betterAuth({
		database: drizzleAdapter(db, {
			provider: "pg",

			schema: schema,
		}),
		trustedOrigins: [env.CORS_ORIGIN],
		emailAndPassword: {
			enabled: true,
		},
		socialProviders: {
			google: {
				clientId: env.GOOGLE_CLIENT_ID,
				clientSecret: env.GOOGLE_CLIENT_SECRET,
			},
			github: {
				clientId: env.GITHUB_CLIENT_ID,
				clientSecret: env.GITHUB_CLIENT_SECRET,
			},
		},
		user: {
			additionalFields: {
				role: {
					type: "string",
					required: false,
					defaultValue: USER_ROLE_VALUES[1], // Default Owner
				},
				phone: {
					type: "string",
					required: false,
				},
			},
		},
		account: {
			accountLinking: {
				enabled: true,
			},
		},
		session: {
			expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
			cookieName: "rently_session",
		},
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
		advanced: {
			cookiePrefix: "rently",
			// biome-ignore lint/style/noProcessEnv: "Only Here"
			useSecureCookies: process.env.NODE_ENV === "production",
			defaultCookieAttributes: {
				sameSite: "none",
				secure: true,
				httpOnly: true,
			},
		},
		plugins: [openAPI()],
	});
}

export const auth = createAuth();
