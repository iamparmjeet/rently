import { ORPCError } from "@orpc/server";
import type { Database } from "@rently/db";
import {
	INVITE_DELIVERY_ERROR_CODES,
	INVITE_DELIVERY_STATUSES,
	type InviteDeliveryErrorCode,
	type TenantOnboardingMode,
} from "@rently/db/constants/rent-constants";
import { tenantInvites } from "@rently/db/schema/schema";
import { sendInviteEmail } from "@rently/email";
import { and, eq, isNull } from "drizzle-orm";
import { enforceSubscriptionLimit } from "../helpers";

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
			),
		)
		.limit(1);

	return existing;
}

type DeliverableInvite = {
	id: string;
	email: string;
	name: string;
	token: string;
};

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

	const existing = await findPendingInvite(db, email, ownerId);

	if (existing) {
		throw new ORPCError("CONFLICT", {
			message: `A pending invite already exists for ${email}. Revoke it first.`,
		});
	}

	await enforceSubscriptionLimit(db, ownerId);

	const token = crypto.randomUUID();
	const expiresAt =
		input.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

	const [invite] = await db
		.insert(tenantInvites)
		.values({
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
			status: "pending",
		})
		.returning();

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
