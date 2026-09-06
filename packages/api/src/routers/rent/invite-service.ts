import { ORPCError } from "@orpc/server";
import { type Database, supportsDatabaseBatch } from "@rently/db";
import {
	INVITE_DELIVERY_ERROR_CODES,
	INVITE_DELIVERY_STATUSES,
	type InviteDeliveryErrorCode,
	type TenantOnboardingMode,
} from "@rently/db/constants/rent-constants";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import { user } from "@rently/db/schema/auth";
import { tenantInvites, tenantProfiles } from "@rently/db/schema/schema";
import { generatedId } from "@rently/db/utils/id";
import { sendInviteEmail } from "@rently/email";
import { and, desc, eq, gt, isNull, lte, or } from "drizzle-orm";
import {
	assertPendingInviteQuotaSql,
	isPendingInviteQuotaError,
	pendingInviteQuotaError,
} from "../helpers/tenant-limit";

type PendingTenantInviteInput = {
	name: string;
	email: string;
	onboardingMode: TenantOnboardingMode;
	phone?: string;
	address?: string;
	emergencyContact?: string;
	emergencyContactName?: string;
	emergencyContactLocation?: string;
	notes?: string;
	expiresAt?: Date;
};

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
				isNull(tenantInvites.deletedAt),
				or(
					isNull(tenantInvites.expiresAt),
					gt(tenantInvites.expiresAt, new Date()),
				),
			),
		)
		.orderBy(desc(tenantInvites.createdAt), desc(tenantInvites.id))
		.limit(1);

	return existing;
}

type DeliverableInvite = {
	id: string;
	email: string;
	name: string;
	token: string;
};

function isPendingInviteConflictError(error: unknown): boolean {
	let current: unknown = error;
	for (let depth = 0; current && depth < 5; depth += 1) {
		const candidate = current as {
			code?: unknown;
			constraint?: unknown;
			message?: unknown;
			cause?: unknown;
		};
		if (
			candidate.code === "23505" &&
			((typeof candidate.message === "string" &&
				candidate.message.includes(
					"tenant_invites_pending_owner_email_unique",
				)) ||
				(typeof candidate.constraint === "string" &&
					candidate.constraint.includes(
						"tenant_invites_pending_owner_email_unique",
					)))
		) {
			return true;
		}
		current = candidate.cause;
	}
	return false;
}

function getSafeDeliveryErrorCode(error: unknown): InviteDeliveryErrorCode {
	const message = error instanceof Error ? error.message.toLowerCase() : "";

	if (message.includes("rate") || message.includes("429")) {
		return INVITE_DELIVERY_ERROR_CODES.RATE_LIMITED;
	}

	if (
		message.includes("recipient") ||
		message.includes("address") ||
		message.includes("rejected")
	) {
		return INVITE_DELIVERY_ERROR_CODES.PROVIDER_REJECTED;
	}

	if (
		message.includes("timeout") ||
		message.includes("network") ||
		message.includes("unavailable")
	) {
		return INVITE_DELIVERY_ERROR_CODES.PROVIDER_UNAVAILABLE;
	}

	return INVITE_DELIVERY_ERROR_CODES.UNKNOWN;
}

export async function sendAndRecordInviteDelivery(
	db: Database,
	{
		invite,
		ownerName,
	}: {
		invite: DeliverableInvite;
		ownerName: string;
	},
): Promise<"sent" | "failed"> {
	try {
		await sendInviteEmail({
			to: invite.email,
			tenantName: invite.name,
			ownerName,
			token: invite.token,
		});
	} catch (error) {
		const deliveryErrorCode = getSafeDeliveryErrorCode(error);

		await db
			.update(tenantInvites)
			.set({
				deliveryStatus: INVITE_DELIVERY_STATUSES.FAILED,
				deliveryErrorCode,
			})
			.where(eq(tenantInvites.id, invite.id));

		console.error("[invite-delivery] email delivery failed", {
			inviteId: invite.id,
			deliveryErrorCode,
		});

		return INVITE_DELIVERY_STATUSES.FAILED;
	}

	await db
		.update(tenantInvites)
		.set({
			deliveryStatus: INVITE_DELIVERY_STATUSES.SENT,
			lastSentAt: new Date(),
			deliveryErrorCode: null,
		})
		.where(eq(tenantInvites.id, invite.id));

	return INVITE_DELIVERY_STATUSES.SENT;
}

// *********** Create Pending Tenant Invite ********************
export async function createPendingTenantInvite(
	db: Database,
	{
		ownerId,
		ownerName,
		input,
		suppressDelivery,
	}: {
		ownerId: string;
		ownerName: string;
		input: PendingTenantInviteInput;
		suppressDelivery?: boolean;
	},
) {
	const email = input.email.trim().toLowerCase();
	const inviteId = generatedId();
	const token = crypto.randomUUID();
	const expiresAt =
		input.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
	const inviteValues = {
		id: inviteId,
		name: input.name,
		email,
		onboardingMode: input.onboardingMode,
		phone: input.phone ?? null,
		address: input.address ?? null,
		emergencyContact: input.emergencyContact ?? null,
		emergencyContactName: input.emergencyContactName ?? null,
		emergencyContactLocation: input.emergencyContactLocation ?? null,
		notes: input.notes ?? null,
		token,
		expiresAt,
		invitedById: ownerId,
		status: "pending" as const,
	};
	const existing = await findPendingInvite(db, email, ownerId);
	if (existing) {
		throw new ORPCError("CONFLICT", {
			message: `A pending invite already exists for ${email}. Revoke it first.`,
		});
	}
	const [existingUser] =
		input.onboardingMode === "owner_prepared"
			? await db
					.select({ id: user.id })
					.from(user)
					.where(eq(user.email, email))
					.limit(1)
			: [];

	const createProfile = (executor: Database, userId: string) =>
		executor.insert(tenantProfiles).values({
			id: generatedId(),
			userId,
			email,
			phone: input.phone ?? null,
			address: input.address ?? null,
			emergencyContact: input.emergencyContact ?? null,
			emergencyContactName: input.emergencyContactName ?? null,
			emergencyContactLocation: input.emergencyContactLocation ?? null,
			invitedId: inviteId,
			createdById: ownerId,
		});

	let invite: typeof tenantInvites.$inferSelect | undefined;
	try {
		if (supportsDatabaseBatch(db)) {
			if (input.onboardingMode === "owner_prepared") {
				if (existingUser) {
					const [, , createdInvites] = await db.batch([
						db.execute(assertPendingInviteQuotaSql(ownerId)),
						db
							.update(tenantInvites)
							.set({ status: "expired", updatedAt: new Date() })
							.where(
								and(
									eq(tenantInvites.invitedById, ownerId),
									eq(tenantInvites.status, "pending"),
									isNull(tenantInvites.deletedAt),
									lte(tenantInvites.expiresAt, new Date()),
								),
							),
						db.insert(tenantInvites).values(inviteValues).returning(),
						createProfile(db, existingUser.id),
					]);
					invite = createdInvites[0];
				} else {
					const [, , createdInvites] = await db.batch([
						db.execute(assertPendingInviteQuotaSql(ownerId)),
						db
							.update(tenantInvites)
							.set({ status: "expired", updatedAt: new Date() })
							.where(
								and(
									eq(tenantInvites.invitedById, ownerId),
									eq(tenantInvites.status, "pending"),
									isNull(tenantInvites.deletedAt),
									lte(tenantInvites.expiresAt, new Date()),
								),
							),
						db.insert(tenantInvites).values(inviteValues).returning(),
						db.insert(user).values({
							id: inviteId,
							name: input.name,
							email,
							emailVerified: false,
							role: USER_ROLES.TENANT,
							phone: input.phone ?? null,
						}),
						createProfile(db, inviteId),
					]);
					invite = createdInvites[0];
				}
			} else {
				const [, , createdInvites] = await db.batch([
					db.execute(assertPendingInviteQuotaSql(ownerId)),
					db
						.update(tenantInvites)
						.set({ status: "expired", updatedAt: new Date() })
						.where(
							and(
								eq(tenantInvites.invitedById, ownerId),
								eq(tenantInvites.status, "pending"),
								isNull(tenantInvites.deletedAt),
								lte(tenantInvites.expiresAt, new Date()),
							),
						),
					db.insert(tenantInvites).values(inviteValues).returning(),
				]);
				invite = createdInvites[0];
			}
		} else {
			invite = await db.transaction(async (tx) => {
				const executor = tx as unknown as Database;
				await executor.execute(assertPendingInviteQuotaSql(ownerId));
				await executor
					.update(tenantInvites)
					.set({ status: "expired", updatedAt: new Date() })
					.where(
						and(
							eq(tenantInvites.invitedById, ownerId),
							eq(tenantInvites.status, "pending"),
							isNull(tenantInvites.deletedAt),
							lte(tenantInvites.expiresAt, new Date()),
						),
					);

				const existing = await findPendingInvite(executor, email, ownerId);
				if (existing) {
					throw new ORPCError("CONFLICT", {
						message: `A pending invite already exists for ${email}. Revoke it first.`,
					});
				}

				const [createdInvite] = await executor
					.insert(tenantInvites)
					.values(inviteValues)
					.returning();
				if (!createdInvite) throw new Error("Failed to create invitation.");

				if (input.onboardingMode === "owner_prepared") {
					if (!existingUser) {
						await executor.insert(user).values({
							id: inviteId,
							name: input.name,
							email,
							emailVerified: false,
							role: USER_ROLES.TENANT,
							phone: input.phone ?? null,
						});
						await createProfile(executor, inviteId);
					} else {
						await createProfile(executor, existingUser.id);
					}
				}

				return createdInvite;
			});
		}
	} catch (error) {
		if (isPendingInviteQuotaError(error)) {
			throw await pendingInviteQuotaError(db, ownerId);
		}
		if (isPendingInviteConflictError(error)) {
			throw new ORPCError("CONFLICT", {
				message: `A pending invite already exists for ${email}. Revoke it first.`,
			});
		}
		throw error;
	}

	if (!invite) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Failed to create invitation.",
		});
	}

	if (suppressDelivery) {
		await db
			.update(tenantInvites)
			.set({ deliveryStatus: "suppressed" })
			.where(eq(tenantInvites.id, invite.id));
		return { invite, deliveryStatus: "suppressed" as const };
	}

	const deliveryStatus = await sendAndRecordInviteDelivery(db, {
		invite,
		ownerName,
	});

	return { invite, deliveryStatus };
}
