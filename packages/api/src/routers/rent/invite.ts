import { ORPCError } from "@orpc/server";
import { isNonLiveWorkspace } from "@rently/api/modules/sample-workspace";
import { ownerProcedure, publicProcedure } from "@rently/api/procedures";
import { StatusCode } from "@rently/api/utils";
import { auth } from "@rently/auth";
import { NOTIFICATION_TYPES } from "@rently/db/constants/notification-constants";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import { account, user } from "@rently/db/schema/auth";
import {
	notifications,
	tenantInvites,
	tenantProfiles,
} from "@rently/db/schema/schema";
import { generatedId } from "@rently/db/utils/id";
import {
	AcceptInviteSchema,
	CreateInviteSchema,
	InviteDetailSchema,
	InviteListItemSchema,
	InvitePublicSchema,
} from "@rently/validators";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
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

		// Hashing happens before the transaction. If this fails, no database state
		// has been written.
		const authContext = await auth.$context;
		const passwordHash = await authContext.password.hash(input.password);

		const acceptedInvite = await db.transaction(async (tx) => {
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

			let claimsOwnerPreparedIdentity = false;
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

				claimsOwnerPreparedIdentity = true;
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

			const tenantUserId = existingUser?.id ?? generatedId();

			if (claimsOwnerPreparedIdentity) {
				await tx
					.update(user)
					.set({
						emailVerified: true,
						phone: profileSource.phone ?? null,
						updatedAt: now,
					})
					.where(eq(user.id, tenantUserId));
			} else {
				await tx.insert(user).values({
					id: tenantUserId,
					name: invite.name,
					email: invite.email.toLowerCase(),
					emailVerified: true,
					role: USER_ROLES.TENANT,
					phone: profileSource.phone ?? null,
				});
			}

			await tx.insert(account).values({
				id: generatedId(),
				userId: tenantUserId,
				accountId: tenantUserId,
				providerId: "credential",
				password: passwordHash,
			});

			if (claimsOwnerPreparedIdentity) {
				await tx
					.update(tenantProfiles)
					.set({
						updatedAt: now,
					})
					.where(eq(tenantProfiles.userId, tenantUserId));
			} else {
				await tx.insert(tenantProfiles).values({
					id: generatedId(),
					userId: tenantUserId,
					email: invite.email.toLowerCase(),
					phone: profileSource.phone ?? null,
					address: profileSource.address ?? null,
					emergencyContact: profileSource.emergencyContact ?? null,
					emergencyContactName: profileSource.emergencyContactName ?? null,
					emergencyContactLocation:
						profileSource.emergencyContactLocation ?? null,
					invitedId: invite.id,
					createdById: invite.invitedById,
				});
			}

			// Conditional transition protects against a concurrent acceptance or
			// an invite expiring while this transaction is in progress. Throwing
			// rolls back the user, credential account, and profile together.
			const [updatedInvite] = await tx
				.update(tenantInvites)
				.set({
					status: "accepted",
					termsAcceptedAt: now,
					termsVersion: KEYHQ_TERMS_VERSION,
					privacyAcknowledgedAt: now,
					privacyVersion: KEYHQ_PRIVACY_VERSION,
				})
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

			if (!updatedInvite) {
				throw new ORPCError("CONFLICT", {
					message:
						"This invitation is no longer available. Refresh the page and try again.",
				});
			}

			return updatedInvite;
		});

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
