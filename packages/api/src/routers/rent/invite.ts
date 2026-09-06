import { ORPCError } from "@orpc/server";
import { isNonLiveWorkspace } from "@rently/api/modules/sample-workspace";
import {
	ownerProcedure,
	publicProcedure,
	tenantProcedure,
} from "@rently/api/procedures";
import { StatusCode } from "@rently/api/utils";
import { auth } from "@rently/auth";
import { supportsDatabaseBatch } from "@rently/db";
import { NOTIFICATION_TYPES } from "@rently/db/constants/notification-constants";
import { account, user } from "@rently/db/schema/auth";
import {
	notifications,
	tenantInvites,
	tenantProfiles,
} from "@rently/db/schema/schema";
import { generatedId } from "@rently/db/utils/id";
import {
	AcceptInviteSchema,
	ClaimInviteSchema,
	CreateInviteSchema,
	InviteDetailSchema,
	InviteListItemSchema,
	InvitePublicSchema,
} from "@rently/validators";
import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import z from "zod";
import { KEYHQ_PRIVACY_VERSION, KEYHQ_TERMS_VERSION } from "../../constants";
import {
	createPendingTenantInvite,
	sendAndRecordInviteDelivery,
} from "./invite-service";

// ******** Router ****************
// 1) Create Invite
export const createInvite = ownerProcedure
	.route({
		method: "POST",
		path: "/rent/invite/create",
		successStatus: StatusCode.CREATED,
	})
	.input(CreateInviteSchema)
	.output(
		z.object({
			invite: InvitePublicSchema,
			deliveryStatus: z.enum(["sent", "failed", "suppressed"]),
		}),
	)
	.handler(async ({ context, input }) => {
		const { db, user } = context;

		// Prevent duplicate pending invites for same email from same owner
		return createPendingTenantInvite(db, {
			ownerId: user.id,
			ownerName: user.name,
			input: {
				...input,
				onboardingMode: "tenant_completed",
			},
			suppressDelivery: isNonLiveWorkspace(user),
		});
	});

// An existing tenant must claim the precise invitation after authenticating.
// D06 intentionally leaves the durable, cross-driver acceptance transition to D08.
export const claimInvite = tenantProcedure
	.route({ method: "POST", path: "/rent/invite/claim" })
	.input(ClaimInviteSchema)
	.output(z.object({ success: z.literal(true) }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;
		const now = new Date();
		const email = authUser.email.trim().toLowerCase();

		const claim = async (
			executor: typeof db,
			tracker?: { createdProfileId?: string },
		) => {
			const [invite] = await executor
				.select({
					id: tenantInvites.id,
					name: tenantInvites.name,
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
						eq(tenantInvites.token, input.token),
						eq(tenantInvites.email, email),
						eq(tenantInvites.status, "pending"),
						isNull(tenantInvites.deletedAt),
						or(
							isNull(tenantInvites.expiresAt),
							gt(tenantInvites.expiresAt, now),
						),
					),
				)
				.limit(1);

			if (!invite) {
				throw new ORPCError("NOT_FOUND", {
					message: "Invitation not found.",
				});
			}

			const [profile] = await executor
				.select({
					id: tenantProfiles.id,
					userId: tenantProfiles.userId,
					createdById: tenantProfiles.createdById,
				})
				.from(tenantProfiles)
				.where(
					and(
						eq(tenantProfiles.invitedId, invite.id),
						isNull(tenantProfiles.deletedAt),
					),
				)
				.limit(1);

			if (profile) {
				if (
					profile.userId !== authUser.id ||
					profile.createdById !== invite.invitedById
				) {
					throw new ORPCError("CONFLICT", {
						message: "Invitation relationship is inconsistent.",
					});
				}
			} else {
				const profileId = generatedId();
				await executor.insert(tenantProfiles).values({
					id: profileId,
					userId: authUser.id,
					email,
					phone: invite.phone,
					address: invite.address,
					emergencyContact: invite.emergencyContact,
					emergencyContactName: invite.emergencyContactName,
					emergencyContactLocation: invite.emergencyContactLocation,
					invitedId: invite.id,
					createdById: invite.invitedById,
				});
				if (tracker) tracker.createdProfileId = profileId;
			}

			const [acceptedInvite] = await executor
				.update(tenantInvites)
				.set({ status: "accepted", updatedAt: now })
				.where(
					and(
						eq(tenantInvites.id, invite.id),
						eq(tenantInvites.status, "pending"),
						isNull(tenantInvites.deletedAt),
						or(
							isNull(tenantInvites.expiresAt),
							gt(tenantInvites.expiresAt, now),
						),
					),
				)
				.returning();

			if (!acceptedInvite) {
				throw new ORPCError("CONFLICT", {
					message:
						"This invitation is no longer available. Refresh the page and try again.",
				});
			}

			return invite;
		};

		let invite: Awaited<ReturnType<typeof claim>>;
		if (supportsDatabaseBatch(db)) {
			const tracker: { createdProfileId?: string } = {};
			try {
				invite = await claim(db, tracker);
			} catch (error) {
				if (tracker.createdProfileId) {
					await db
						.delete(tenantProfiles)
						.where(eq(tenantProfiles.id, tracker.createdProfileId))
						.catch(() => {});
				}
				throw error;
			}
		} else {
			invite = await (
				db as unknown as {
					transaction: (
						fn: (tx: typeof db) => Promise<typeof invite>,
					) => Promise<typeof invite>;
				}
			).transaction((tx) => claim(tx as unknown as typeof db));
		}

		try {
			await db.insert(notifications).values({
				id: generatedId(),
				userId: invite.invitedById,
				type: NOTIFICATION_TYPES.INVITE_ACCEPTED,
				title: "Tenant joined",
				message: `${authUser.name ?? ""} accepted your invite and joined KeyHQ`,
				entityId: invite.id,
				entityType: "invite",
			});
		} catch (error) {
			console.error("[invite-claim] invite-accepted notification failed", {
				inviteId: invite.id,
				error,
			});
		}

		return { success: true as const };
	});

// 2) ResendInvite
export const resendInvite = ownerProcedure
	.route({
		method: "POST",
		path: "/rent/invite/resend",
	})
	.input(
		z.object({
			inviteId: z.uuid(),
		}),
	)
	.output(
		z.object({
			deliveryStatus: z.enum(["sent", "failed", "suppressed"]),
		}),
	)
	.handler(async ({ context, input }) => {
		const { db, user } = context;

		const [invite] = await db
			.select({
				id: tenantInvites.id,
				email: tenantInvites.email,
				name: tenantInvites.name,
				token: tenantInvites.token,
				status: tenantInvites.status,
				expiresAt: tenantInvites.expiresAt,
			})
			.from(tenantInvites)
			.where(
				and(
					eq(tenantInvites.id, input.inviteId),
					eq(tenantInvites.invitedById, user.id),
					isNull(tenantInvites.deletedAt),
				),
			)
			.limit(1);

		// Return NOT_FOUND for both missing and cross-owner invites.
		if (!invite) {
			throw new ORPCError("NOT_FOUND", {
				message: "Invitation not found.",
			});
		}

		if (invite.status !== "pending") {
			throw new ORPCError("CONFLICT", {
				message: "Only pending invitations can be resent.",
			});
		}

		if (invite.expiresAt && invite.expiresAt <= new Date()) {
			await db
				.update(tenantInvites)
				.set({
					status: "expired",
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(tenantInvites.id, invite.id),
						eq(tenantInvites.invitedById, user.id),
					),
				);

			throw new ORPCError("GONE", {
				message: "This invitation has expired. Create a new invitation.",
			});
		}

		if (isNonLiveWorkspace(user)) {
			await db
				.update(tenantInvites)
				.set({ deliveryStatus: "suppressed", deliveryErrorCode: null })
				.where(eq(tenantInvites.id, invite.id));
			return { deliveryStatus: "suppressed" as const };
		}

		const deliveryStatus = await sendAndRecordInviteDelivery(db, {
			invite,
			ownerName: user.name,
		});

		return {
			deliveryStatus,
		};
	});

// 3) List Invites *******************
export const listInvites = ownerProcedure
	.route({ method: "GET", path: "/rent/invite/list" })
	.output(z.object({ invites: z.array(InviteListItemSchema) }))
	.handler(async ({ context }) => {
		const { db, user } = context;

		const invites = await db
			.select({
				id: tenantInvites.id,
				email: tenantInvites.email,
				name: tenantInvites.name,
				status: tenantInvites.status,
				createdAt: tenantInvites.createdAt,
			})
			.from(tenantInvites)
			.where(eq(tenantInvites.invitedById, user.id))
			.orderBy(desc(tenantInvites.createdAt));

		return { invites };
	});

// 4) Get Invites by token ***************
export const getInviteByToken = publicProcedure
	.route({ method: "GET", path: "/rent/invite/verify" })
	.input(z.object({ token: z.uuid("Invalid Invite Link") }))
	.output(z.object({ invite: InviteDetailSchema }))
	.handler(async ({ context, input }) => {
		const { db } = context;
		// find by token
		const [invite] = await db
			.select({
				id: tenantInvites.id,
				name: tenantInvites.name,
				email: tenantInvites.email,
				phone: tenantInvites.phone,
				status: tenantInvites.status,
				expiresAt: tenantInvites.expiresAt,
				deletedAt: tenantInvites.deletedAt,
				emergencyContact: tenantInvites.emergencyContact,
				invitedById: tenantInvites.invitedById,
				onboardingMode: tenantInvites.onboardingMode,
				address: tenantInvites.address,
				emergencyContactName: tenantInvites.emergencyContactName,
				emergencyContactLocation: tenantInvites.emergencyContactLocation,
			})
			.from(tenantInvites)
			.where(
				and(
					eq(tenantInvites.token, input.token),
					isNull(tenantInvites.deletedAt),
				),
			)
			.limit(1);

		if (!invite) {
			throw new ORPCError("NOT_FOUND", {
				message: "This invite link is invalid or has already been used.",
			});
		}

		if (invite.status === "accepted") {
			throw new ORPCError("CONFLICT", {
				message: "This invitation has already been accepted. Please log in",
			});
		}

		if (invite.status === "expired") {
			throw new ORPCError("GONE", {
				message:
					"This invite link has expired. Ask your landlord to send a new one.",
			});
		}

		if (invite.expiresAt && new Date() > invite.expiresAt) {
			await db
				.update(tenantInvites)
				.set({ status: "expired" })
				.where(eq(tenantInvites.id, invite.id));

			throw new ORPCError("GONE", {
				message: "This Invite has expired, Ask you landlord to send a new one.",
			});
		}

		// separate query for owner name - avoid adding a relation just for this -- Required function
		const [owner] = await db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				ownerName: user.name,
			})
			.from(user)
			.where(eq(user.id, invite.invitedById))
			.limit(1);

		return {
			invite: {
				...invite,
				invitedBy: {
					id: owner?.id ?? "",
					name: owner?.name ?? null,
					email: owner?.email ?? "",
					ownerName: owner?.ownerName ?? "Your Landlord",
				},
			},
		};
	});

// 5) Accept Invite
export const acceptInvite = publicProcedure
	.route({
		method: "POST",
		path: "/rent/invite/accept",
		successStatus: StatusCode.CREATED,
	})
	.input(AcceptInviteSchema)
	.output(
		z.object({
			success: z.boolean(),
			message: z.string(),
		}),
	)
	.handler(async ({ context, input }) => {
		const { db } = context;
		const now = new Date();

		// Hashing happens before any DB write. If this fails, no state has been written.
		const authContext = await auth.$context;
		const passwordHash = await authContext.password.hash(input.password);

		// The claim/update CTE is the durable gate. Every identity write depends
		// on its returned row, so a concurrent loser performs no writes on either
		// node-postgres or Neon HTTP.
		const executeAcceptInvite = async (executor: typeof db) => {
			const tx = executor;
			const [invite] = await tx
				.select({
					id: tenantInvites.id,
					name: tenantInvites.name,
					email: tenantInvites.email,
					onboardingMode: tenantInvites.onboardingMode,
					phone: tenantInvites.phone,
					address: tenantInvites.address,
					emergencyContact: tenantInvites.emergencyContact,
					emergencyContactName: tenantInvites.emergencyContactName,
					emergencyContactLocation: tenantInvites.emergencyContactLocation,
					status: tenantInvites.status,
					expiresAt: tenantInvites.expiresAt,
					invitedById: tenantInvites.invitedById,
				})
				.from(tenantInvites)
				.where(
					and(
						eq(tenantInvites.token, input.token),
						isNull(tenantInvites.deletedAt),
					),
				)
				.limit(1);

			if (!invite) {
				throw new ORPCError("NOT_FOUND", {
					message: "Invalid invite link.",
				});
			}

			const [inviter] = await tx
				.select({
					accountMode: user.accountMode,
					workspaceMode: user.workspaceMode,
				})
				.from(user)
				.where(eq(user.id, invite.invitedById))
				.limit(1);
			if (inviter && isNonLiveWorkspace(inviter)) {
				throw new ORPCError("FORBIDDEN", {
					message: "Demo and sample invitations cannot be accepted.",
				});
			}

			if (invite.status === "accepted") {
				throw new ORPCError("CONFLICT", {
					message: "This invitation has already been accepted. Please log in.",
				});
			}

			if (
				invite.status === "expired" ||
				(invite.expiresAt !== null && invite.expiresAt <= now)
			) {
				throw new ORPCError("GONE", {
					message:
						"This invitation has expired. Ask your landlord to send a new one.",
				});
			}

			if (invite.status !== "pending") {
				throw new ORPCError("GONE", {
					message: "This invitation is no longer available.",
				});
			}

			const [existingUser] = await tx
				.select({ id: user.id })
				.from(user)
				.where(eq(user.email, invite.email.toLowerCase()))
				.limit(1);

			if (existingUser) {
				if (invite.onboardingMode !== "owner_prepared") {
					throw new ORPCError("CONFLICT", {
						message:
							"An account with this email already exists. Please log in.",
					});
				}

				const [preparedProfile] = await tx
					.select({ id: tenantProfiles.id })
					.from(tenantProfiles)
					.where(
						and(
							eq(tenantProfiles.userId, existingUser.id),
							eq(tenantProfiles.invitedId, invite.id),
							eq(tenantProfiles.createdById, invite.invitedById),
						),
					)
					.limit(1);

				const [credentialAccount] = await tx
					.select({ id: account.id })
					.from(account)
					.where(
						and(
							eq(account.userId, existingUser.id),
							eq(account.providerId, "credential"),
						),
					)
					.limit(1);

				if (!preparedProfile || credentialAccount) {
					throw new ORPCError("CONFLICT", {
						message:
							"An account with this email already exists. Please log in.",
					});
				}
			}

			const tenantCompletedFieldsWereSupplied = [
				input.phone,
				input.address,
				input.emergencyContact,
				input.emergencyContactName,
				input.emergencyContactLocation,
			].some((value) => value !== undefined && value !== "");

			if (
				invite.onboardingMode === "owner_prepared" &&
				tenantCompletedFieldsWereSupplied
			) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"This invitation uses owner-prepared profile details. Contact your landlord to correct them.",
				});
			}
			const profileSource =
				invite.onboardingMode === "owner_prepared" ? invite : input;

			const result = await executor.execute<{
				id: string;
				name: string;
				invitedById: string;
			}>(sql`
				WITH claimed AS (
					UPDATE ${tenantInvites} i
					SET "status" = 'accepted',
						"terms_accepted_at" = now(),
						"terms_version" = ${KEYHQ_TERMS_VERSION},
						"privacy_acknowledged_at" = now(),
						"privacy_version" = ${KEYHQ_PRIVACY_VERSION}
					FROM ${user} inviter
					WHERE i."token" = ${input.token}
						AND i."status" = 'pending'
						AND i."deleted_at" IS NULL
						AND (i."expires_at" IS NULL OR i."expires_at" > now())
						AND inviter."id" = i."invited_by"
						AND (
							(i."onboarding_mode" = 'tenant_completed' AND NOT EXISTS (
								SELECT 1 FROM ${user} existing_user
								WHERE lower(existing_user."email") = lower(i."email")
							))
							OR (i."onboarding_mode" = 'owner_prepared' AND (
								NOT EXISTS (
									SELECT 1 FROM ${user} existing_user
									WHERE lower(existing_user."email") = lower(i."email")
								)
								OR EXISTS (
									SELECT 1
									FROM ${user} prepared_user
									JOIN ${tenantProfiles} prepared_profile
										ON prepared_profile."user_id" = prepared_user."id"
									WHERE lower(prepared_user."email") = lower(i."email")
										AND prepared_profile."invite_id" = i."id"
										AND prepared_profile."created_by" = i."invited_by"
										AND NOT EXISTS (
											SELECT 1 FROM ${account} prepared_account
											WHERE prepared_account."user_id" = prepared_user."id"
												AND prepared_account."provider_id" = 'credential'
										)
								)
							))
						)
					RETURNING i."id", i."name", i."email", i."onboarding_mode", i."phone",
						i."address", i."emergency_contact", i."emergency_contact_name",
						i."emergency_contact_location", i."invited_by"
				), existing_identity AS (
					SELECT c."id" AS invite_id, c."name", c."email", c."onboarding_mode",
						c."phone", c."address", c."emergency_contact", c."emergency_contact_name",
						c."emergency_contact_location", c."invited_by", existing_user."id" AS user_id
					FROM claimed c
					JOIN ${user} existing_user
						ON lower(existing_user."email") = lower(c."email")
				), new_identity AS (
					INSERT INTO ${user} ("id", "name", "email", "email_verified", "role", "phone")
					SELECT gen_random_uuid(), c."name", lower(c."email"), true, 'tenant', c."phone"
					FROM claimed c
					WHERE NOT EXISTS (SELECT 1 FROM existing_identity)
					RETURNING "id"
				), identities AS (
					SELECT user_id FROM existing_identity
					UNION ALL
					SELECT "id" AS user_id FROM new_identity
				), created_accounts AS (
					INSERT INTO ${account} ("id", "user_id", "account_id", "provider_id", "password")
					SELECT gen_random_uuid(), user_id, user_id, 'credential', ${passwordHash}
					FROM identities
					RETURNING "user_id"
				), updated_users AS (
					UPDATE ${user} updated_user
					SET "email_verified" = true,
						"phone" = existing_identity."phone",
						"updated_at" = now()
					FROM existing_identity
					JOIN created_accounts ON created_accounts."user_id" = existing_identity.user_id
					WHERE updated_user."id" = existing_identity.user_id
					RETURNING updated_user."id"
				), updated_profiles AS (
					UPDATE ${tenantProfiles} profile
					SET "updated_at" = now()
					FROM existing_identity
					JOIN created_accounts ON created_accounts."user_id" = existing_identity.user_id
					WHERE existing_identity."onboarding_mode" = 'owner_prepared'
						AND profile."user_id" = existing_identity.user_id
						AND profile."invite_id" = existing_identity.invite_id
						AND profile."created_by" = existing_identity."invited_by"
					RETURNING profile."id"
				), created_profiles AS (
					INSERT INTO ${tenantProfiles} (
						"id", "user_id", "email", "phone", "address", "emergency_contact",
						"emergency_contact_name", "emergency_contact_location", "invite_id", "created_by"
					)
					SELECT gen_random_uuid(), identities.user_id, lower(claimed."email"),
						CASE WHEN claimed."onboarding_mode" = 'owner_prepared' THEN claimed."phone" ELSE ${profileSource.phone ?? null} END,
						CASE WHEN claimed."onboarding_mode" = 'owner_prepared' THEN claimed."address" ELSE ${profileSource.address ?? null} END,
						CASE WHEN claimed."onboarding_mode" = 'owner_prepared' THEN claimed."emergency_contact" ELSE ${profileSource.emergencyContact ?? null} END,
						CASE WHEN claimed."onboarding_mode" = 'owner_prepared' THEN claimed."emergency_contact_name" ELSE ${profileSource.emergencyContactName ?? null} END,
						CASE WHEN claimed."onboarding_mode" = 'owner_prepared' THEN claimed."emergency_contact_location" ELSE ${profileSource.emergencyContactLocation ?? null} END,
						claimed."id", claimed."invited_by"
					FROM claimed
					JOIN identities ON true
					JOIN created_accounts ON created_accounts."user_id" = identities.user_id
					WHERE NOT EXISTS (
						SELECT 1 FROM ${tenantProfiles} existing_profile
						WHERE existing_profile."user_id" = identities.user_id
							AND existing_profile."invite_id" = claimed."id"
							AND existing_profile."created_by" = claimed."invited_by"
					)
					RETURNING "id"
				)
				SELECT c."id", c."name", c."invited_by" AS "invitedById"
				FROM claimed c
				WHERE EXISTS (SELECT 1 FROM created_accounts)
					AND (EXISTS (SELECT 1 FROM updated_profiles) OR EXISTS (SELECT 1 FROM created_profiles))
			`);

			const [acceptedInvite] = result.rows;
			if (!acceptedInvite) {
				throw new ORPCError("CONFLICT", {
					message:
						"This invitation is no longer available. Refresh the page and try again.",
				});
			}

			return acceptedInvite;
		};

		const acceptedInvite = await executeAcceptInvite(db);

		try {
			await db.insert(notifications).values({
				userId: acceptedInvite.invitedById,
				type: NOTIFICATION_TYPES.INVITE_ACCEPTED,
				title: "Tenant joined",
				message: `${acceptedInvite.name} accepted your invite and joined KeyHQ`,
				entityId: acceptedInvite.id,
				entityType: "invite",
			});
		} catch {
			console.error("[invite:acceptInvite] notification failed", {
				inviteId: acceptedInvite.id,
			});
		}

		return {
			success: true,
			message: "Account created successfully! Please log in with your email.",
		};
	});
