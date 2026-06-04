import { createDb } from "@rently/db";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import * as schema from "@rently/db/schema/auth";
import { generatedId } from "@rently/db/utils/id";
import { sendPasswordResetEmail, sendTenantSetupEmail } from "@rently/email";
import { env } from "@rently/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI } from "better-auth/plugins";

const authHostname = new URL(env.BETTER_AUTH_URL).hostname;
const isProduction = env.NODE_ENV === "production";
const cookieDomain = isProduction
	? `.${authHostname.split(".").slice(-2).join(".")}`
	: undefined;

const trustedOrigins = env.CORS_ORIGINS;

export function createAuth() {
	const db = createDb();

	return betterAuth({
		database: drizzleAdapter(db, {
			provider: "pg",
			schema: schema,
		}),
		trustedOrigins,
		emailAndPassword: {
			enabled: true,
			sendResetPassword: async ({ user, url }) => {
				// / Role guard — this callback fires for ALL password resets
				// Owners requesting a reset would hit this too in future
				// TODO: add owner reset email branch when owner auth page is built
				const typeUser = user as typeof user & { role?: string };
				if (typeUser.role === USER_ROLES.TENANT) {
					const urlObj = new URL(url);
					const ownerParam = urlObj.searchParams.get("owner");

					const ownerName = ownerParam
						? decodeURIComponent(ownerParam)
						: "Your Landlord";

					await sendTenantSetupEmail({
						to: user.email,
						tenantName: user.name ?? user.email,
						ownerName,
						setupUrl: url,
					});
					return;
				}
				// owner Flow
				await sendPasswordResetEmail({
					to: user.email,
					name: user.name ?? "User",
					resetUrl: url,
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
			// cookieName: "rently_session",
		},
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
		advanced: {
			cookiePrefix: "rently",
			useSecureCookies: process.env.NODE_ENV === "production",
			defaultCookieAttributes: {
				domain: cookieDomain,
				sameSite:
					env.NODE_ENV === "production" ? ("lax" as const) : ("lax" as const),
				secure: isProduction,
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
