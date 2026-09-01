import { createDb } from "@rently/db";
import { NOTIFICATION_TYPES } from "@rently/db/constants/notification-constants";
import {
	BILLING_INTERVAL,
	PLAN_STATUS,
} from "@rently/db/constants/payment-constants";
import { INVITE_STATUSES } from "@rently/db/constants/rent-constants";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import {
	ACCOUNT_MODES,
	WORKSPACE_MODES,
} from "@rently/db/constants/workspace-modes";
import * as schema from "@rently/db/schema/auth";
import {
	notifications,
	tenantInvites,
	tenantProfiles,
} from "@rently/db/schema/schema";
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
import { and, eq, gt, isNull, or } from "drizzle-orm";

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
					// WHY: A pending invite for this email must win over the default
					// OWNER role. This runs for both email signup and social OAuth.
					before: async (userData) =>
						claimPendingTenantInvite(db, userData, new Date()),
					after: async (user) => {
						const role = user.role as string | undefined;

						// A tenant who signed up through the normal invite-less path
						// (e.g. Google login with a pending invite) still needs their
						// profile created and invite accepted.
						if (role === USER_ROLES.TENANT) {
							try {
								await completeInviteForUser(db, user, new Date());
							} catch (error) {
								console.error(
									"[auth:hook] Failed to complete invite for tenant",
									{ userId: user.id, error },
								);
							}
							return;
						}

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

type PendingInviteRow = {
	id: string;
	status: string;
	onboardingMode: string;
	email: string;
	phone: string | null;
	address: string | null;
	emergencyContact: string | null;
	emergencyContactName: string | null;
	emergencyContactLocation: string | null;
	invitedById: string;
};

async function findPendingInviteByEmail(
	database: ReturnType<typeof createDb>,
	email: string,
	now: Date,
): Promise<PendingInviteRow | undefined> {
	if (!email) return undefined;

	const [invite] = await database
		.select({
			id: tenantInvites.id,
			status: tenantInvites.status,
			onboardingMode: tenantInvites.onboardingMode,
			email: tenantInvites.email,
			phone: tenantInvites.phone,
			address: tenantInvites.address,
			emergencyContact: tenantInvites.emergencyContact,
			emergencyContactName: tenantInvites.emergencyContactName,
			emergencyContactLocation: tenantInvites.emergencyContactLocation,
			invitedById: tenantInvites.invitedById,
		})
		.from(tenantInvites)
		.where(
			and(
				eq(tenantInvites.email, email),
				isNull(tenantInvites.deletedAt),
				or(isNull(tenantInvites.expiresAt), gt(tenantInvites.expiresAt, now)),
			),
		)
		.orderBy(tenantInvites.createdAt)
		.limit(1);

	if (!invite || invite.status !== INVITE_STATUSES.PENDING) return undefined;

	return invite;
}

/**
 * When a user signs up (via email or a social provider) with an email that has
 * a pending landlord invite, assign the TENANT role instead of the default OWNER.
 *
 * Only tenant-completed invites reach this path. Owner-prepared invites already
 * create a provisional user (role TENANT) up front, so Better Auth's account
 * linking attaches a Google login to that existing user — no new user is created
 * here and its tenant role is preserved.
 *
 * The hook returns undefined when there is nothing to claim (or the invite was
 * already accepted), which lets Better Auth create the user normally.
 */
async function claimPendingTenantInvite(
	database: ReturnType<typeof createDb>,
	userData: Record<string, unknown>,
	now: Date,
): Promise<{ data: { role: string } } | undefined> {
	const email = String(userData.email ?? "")
		.trim()
		.toLowerCase();
	const invite = await findPendingInviteByEmail(database, email, now);
	if (!invite) return undefined;

	return {
		data: {
			role: USER_ROLES.TENANT,
		},
	};
}

/**
 * When a tenant-completed invite is claimed through a regular signup (email or
 * Google), the account exists but no tenant profile was ever created and the
 * invite is still pending. Create the profile from the invite data and accept
 * the invite so the owner's list and the tenant portal stay consistent.
 *
 * Runs only for freshly created users, so owner-prepared invites (which reuse
 * an existing provisional user) never reach this path.
 */
async function completeInviteForUser(
	database: ReturnType<typeof createDb>,
	user: Record<string, unknown>,
	now: Date,
): Promise<void> {
	const email = String(user.email ?? "")
		.trim()
		.toLowerCase();
	const invite = await findPendingInviteByEmail(database, email, now);
	if (!invite) return;

	await database.insert(tenantProfiles).values({
		id: generatedId(),
		userId: user.id as string,
		email,
		phone: invite.phone,
		address: invite.address,
		emergencyContact: invite.emergencyContact,
		emergencyContactName: invite.emergencyContactName,
		emergencyContactLocation: invite.emergencyContactLocation,
		invitedId: invite.id,
		createdById: invite.invitedById,
	});

	const [acceptedInvite] = await database
		.update(tenantInvites)
		.set({ status: INVITE_STATUSES.ACCEPTED, updatedAt: now })
		.where(
			and(
				eq(tenantInvites.id, invite.id),
				eq(tenantInvites.status, INVITE_STATUSES.PENDING),
				isNull(tenantInvites.deletedAt),
				or(isNull(tenantInvites.expiresAt), gt(tenantInvites.expiresAt, now)),
			),
		)
		.returning();

	if (!acceptedInvite) return;

	try {
		await database.insert(notifications).values({
			id: generatedId(),
			userId: invite.invitedById,
			type: NOTIFICATION_TYPES.INVITE_ACCEPTED,
			title: "Tenant joined",
			message: `${user.name ?? ""} accepted your invite and joined KeyHQ`,
			entityId: invite.id,
			entityType: "invite",
		});
	} catch (error) {
		console.error("[auth:hook] invite-accepted notification failed", {
			inviteId: invite.id,
			error,
		});
	}
}

export const auth = createAuth();
export type Auth = typeof auth;
