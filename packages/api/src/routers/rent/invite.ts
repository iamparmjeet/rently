import { ORPCError } from "@orpc/client";
import { protectedProcedure, publicProcedure } from "@rently/api/procedures";
import { StatusCode, StatusPhrase, sendInviteEmail } from "@rently/api/utils";
import { auth } from "@rently/auth";
import { type Database, db } from "@rently/db";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import { user } from "@rently/db/schema/auth";
import { tenantInvites, tenantProfiles } from "@rently/db/schema/schema";
import {
	AcceptInviteSchema,
	CreateInviteSchema,
	InviteDetailSchema,
	InviteListItemSchema,
	InvitePublicSchema,
} from "@rently/validators";
import { and, desc, eq } from "drizzle-orm";
import z from "zod";

// Helper function
async function findPendingInvite(
	db: Database,
	email: string,
	invitedById: string,
) {
	const [existing] = await db
		.select({ id: tenantInvites.id })
		.from(tenantInvites)
		.where(
			and(
				eq(tenantInvites.email, email),
				eq(tenantInvites.invitedById, invitedById),
				eq(tenantInvites.status, "pending"),
			),
		)
		.limit(1);
	return existing;
}

// 1) Create Invite
export const createInvite = protectedProcedure
	.route({
		method: "POST",
		path: "/rent/invite/create",
		successStatus: StatusCode.CREATED,
	})
	.input(CreateInviteSchema)
	.output(z.object({ invite: InvitePublicSchema }))
	.handler(async ({ context, input }) => {
		const { db, user } = context;

		// Prevent duplicate pending invites for same email from same owner
		//
		const existing = await findPendingInvite(db, input.email, user.id);

		if (existing) {
			throw new ORPCError(StatusPhrase.CONFLICT, {
				message: `A pending invite already exists for ${input.email}. Revoke it first.`,
			});
		}

		const token = crypto.randomUUID();
		// Default 7 days expiry if owner doesn't specify
		const expiresAt =
			input.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

		const [invite] = await db
			.insert(tenantInvites)
			.values({
				...input,
				phone: input.phone ?? null,
				emergencyContact: input.emergencyContact ?? null,
				notes: input.notes ?? null,
				token,
				expiresAt,
				invitedById: user.id,
				status: "pending",
			})
			.returning();

		if (!invite) {
			throw new ORPCError(StatusPhrase.INTERNAL_SERVER_ERROR, {
				message: "Failed to create invite.",
			});
		}

		// Fire email — non-blocking (see email utility for why we don't throw)
		sendInviteEmail({
			to: input.email,
			tenantName: input.name,
			ownerName: user.name,
			token,
		}).catch(console.error);

		return { invite };
	});

// 2) List Invites
export const listInvites = protectedProcedure
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

// 3) Get Invites by token
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
				emergencyContact: tenantInvites.emergencyContact,
				invitedById: tenantInvites.invitedById,
			})
			.from(tenantInvites)
			.where(eq(tenantInvites.token, input.token))
			.limit(1);

		if (!invite) {
			throw new ORPCError(StatusPhrase.NOT_FOUND, {
				message: "This invite link is invalid or has already been used.",
			});
		}

		if (invite.status === "accepted") {
			throw new ORPCError(StatusPhrase.CONFLICT, {
				message: "This invitation has already been accepted. Please log in",
			});
		}

		if (invite.status === "expired") {
			throw new ORPCError(StatusPhrase.GONE, {
				message:
					"This invite link has expired. Ask your landlord to send a new one.",
			});
		}

		if (invite.expiresAt && new Date() > invite.expiresAt) {
			await db
				.update(tenantInvites)
				.set({ status: "expired" })
				.where(eq(tenantInvites.id, invite.id));

			throw new ORPCError(StatusPhrase.GONE, {
				message: "This Invite has expired, Ask you landlord to send a new one.",
			});
		}

		// separate query for owner name - avoid adding a relation just for this -- Required function
		const [owner] = await db
			.select({
				ownerName: user.name,
			})
			.from(user)
			.where(eq(user.id, invite.invitedById))
			.limit(1);

		return {
			invite: {
				...invite,
				ownerName: owner?.ownerName ?? "Your Landlord",
			},
		};
	});

// 4) Accept Invite
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

		// 1) Validate getInviteByToken
		const [invite] = await db
			.select({
				id: tenantInvites.id,
				name: tenantInvites.name,
				email: tenantInvites.email,
				phone: tenantInvites.phone,
				status: tenantInvites.status,
				expiresAt: tenantInvites.expiresAt,
				emergencyContact: tenantInvites.emergencyContact,
			})
			.from(tenantInvites)
			.where(eq(tenantInvites.token, input.token))
			.limit(1);

		if (!invite) {
			throw new ORPCError(StatusPhrase.NOT_FOUND, {
				message: "Invalid invite link.",
			});
		}

		if (invite.status !== "pending") {
			const msg =
				invite.status === "accepted"
					? "This Invite Link has already been used. Please log in."
					: "Ths invite is no longer valid.";
			throw new ORPCError(StatusPhrase.CONFLICT, {
				message: msg,
			});
		}

		// Step 2 - Create user via better-auth
		const signupResult = await auth.api.signUpEmail({
			body: {
				email: invite.email,
				name: invite.name ?? invite.email,
				password: input.password,
				phone: input.phone ?? invite.phone ?? undefined,
				role: USER_ROLES.TENANT,
			},
			headers: context.headers,
		});

		if (!signupResult.user) {
			throw new ORPCError(StatusPhrase.CONFLICT, {
				message: "An account with this email already exists. Please log in.",
			});
		}

		const newUserId = signupResult.user.id;

		// Step 3 -> Transaction - profile + invite status
		await db.transaction(async (tx) => {
			await tx.insert(tenantProfiles).values({
				id: crypto.randomUUID(),
				userId: newUserId,
				emergencyContact: invite.emergencyContact ?? null,
			});

			await tx
				.update(tenantInvites)
				.set({ status: "accepted" })
				.where(eq(tenantInvites.id, invite.id));
		});

		return {
			success: true,
			message: "Account created successfully! Please log in with your email.",
		};
	});
