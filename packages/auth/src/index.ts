import { sendTenantSetupEmail } from "@rently/api/utils";
import { createDb } from "@rently/db";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import * as schema from "@rently/db/schema/auth";
import { generatedId } from "@rently/db/utils/id";
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
				// / Role guard — this callback fires for ALL password resets
				// Owners requesting a reset would hit this too in future
				// TODO: add owner reset email branch when owner auth page is built
				const typeUser = user as typeof user & { role?: string };
				if (typeUser.role !== USER_ROLES.TENANT) {
					return;
				}
				const urlObj = new URL(url);
				const ownerName = urlObj.searchParams.get("owner")
					? decodeURIComponent(urlObj.searchParams.get("owner")!)
					: "Your Landlord";

				await sendTenantSetupEmail({
					to: user.email,
					tenantName: user.name ?? user.email,
					ownerName,
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
			useSecureCookies: process.env.NODE_ENV === "production",
			defaultCookieAttributes: {
				sameSite: "none",
				secure: true,
				httpOnly: true,
			},
			database: {
				// generateId: "uuid",
				generateId: () => generatedId(), // for runtime
			},
		},

		plugins: [openAPI()],
	});
}

export const auth = createAuth();
