import { createDb } from "@rently/db";
import {
	BILLING_INTERVAL,
	PLAN_STATUS,
} from "@rently/db/constants/payment-constants";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import {
	ACCOUNT_MODES,
	WORKSPACE_MODES,
} from "@rently/db/constants/workspace-modes";
import * as schema from "@rently/db/schema/auth";
import { plans, subscriptions } from "@rently/db/schema/subscription";
import { generatedId } from "@rently/db/utils/id";
import {
	sendPasswordResetEmail,
	sendTenantSetupEmail,
	sendVerificationEmail,
} from "@rently/email";
import { env } from "@rently/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI } from "better-auth/plugins";
import { eq } from "drizzle-orm";

const authHostname = new URL(env.BETTER_AUTH_URL).hostname;
const isProduction = env.NODE_ENV === "production";
const cookieDomain = isProduction
	? `.${authHostname.split(".").slice(-2).join(".")}`
	: undefined;

const trustedOrigins = Array.isArray(env.CORS_ORIGINS)
	? env.CORS_ORIGINS
	: String(env.CORS_ORIGINS)
			.split(",")
			.map((o) => o.trim());

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
			requireEmailVerification: true,
			sendResetPassword: async ({ user, url }) => {
				// This callback handles every password-reset request.
				// Tenants receive a setup email; owners receive the standard reset email.
				const typeUser = user as typeof user & {
					role?: string;
					accountMode?: string;
				};
				if (typeUser.accountMode === ACCOUNT_MODES.PUBLIC_DEMO) return;
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
				// Owner flow
				await sendPasswordResetEmail({
					to: user.email,
					name: user.name ?? "User",
					resetUrl: url,
				});
			},
		},
		emailVerification: {
			sendVerificationEmail: async ({ user, url }) => {
				await sendVerificationEmail({
					to: user.email,
					name: user.name ?? user.email,
					verificationUrl: url,
				});
			},
			sendOnSignIn: true,
			sendOnSignUp: true,
			autoSignInAfterVerification: true,
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
					input: false,
				},
				phone: {
					type: "string",
					required: false,
					input: true,
				},
				accountMode: {
					type: "string",
					required: false,
					defaultValue: ACCOUNT_MODES.STANDARD,
					input: false,
				},
				workspaceMode: {
					type: "string",
					required: false,
					defaultValue: WORKSPACE_MODES.LIVE,
					input: false,
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
		databaseHooks: {
			user: {
				create: {
					after: async (user) => {
						const role = user.role as string | undefined;

						if (role !== USER_ROLES.OWNER) return;

						try {
							const [freePlan] = await db
								.select({ id: plans.id })
								.from(plans)
								.where(eq(plans.slug, "free"))
								.limit(1);

							if (!freePlan) {
								console.error(
									"[auth:hook] Free plan not seeded — owner has no subscription. Run db:seed.",
								);
								return;
							}

							await db.insert(subscriptions).values({
								id: generatedId(),
								userId: user.id,
								planId: freePlan.id,
								status: PLAN_STATUS.ACTIVE,
								billingInterval: BILLING_INTERVAL.MONTHLY,
								currentPeriodStart: new Date(),
								// null: the free plan never expires. No billing date needed.
								currentPeriodEnd: null,
								expired: false,
							});
						} catch (err) {
							console.error(
								"[auth:hook] Failed to provision free subscription:",
								err,
							);
						}
					},
				},
			},
		},
		plugins: [openAPI()],
	});
}

export const auth = createAuth();
export type Auth = typeof auth;
