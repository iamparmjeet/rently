import { sendTenantSetupEmail } from "@rently/api/utils";
import { createDb } from "@rently/db";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import * as schema from "@rently/db/schema/auth";
import { env } from "@rently/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI } from "better-auth/plugins";

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
			sendResetPassword: async ({ user, url }) => {
				await sendTenantSetupEmail({
					to: user.email,
					tenantName: user.name ?? user.email,
					ownerName: "Your Landlord", // No owner context available at auth layer
					setupUrl: url,
				});
			},
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
					defaultValue: USER_ROLES.OWNER, // Default Owner
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
