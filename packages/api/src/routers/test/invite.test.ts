import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import { user } from "@rently/db/schema/auth";
import { tenantInvites } from "@rently/db/schema/schema";
import { eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
	sendInviteEmail: vi.fn(),
}));

vi.mock("@rently/auth", () => ({
	auth: {
		api: {
			getSession: mocks.getSession,
		},
	},
}));

vi.mock("@rently/email", () => ({
	sendInviteEmail: mocks.sendInviteEmail,
}));

import { createInvite, resendInvite } from "../rent/invite";

const db = createDb();
const createdUserIds: string[] = [];
const createdInviteIds: string[] = [];

async function createOwner(name: string) {
	const id = crypto.randomUUID();
	const email = `${id}@test.keyhq.invalid`;

	createdUserIds.push(id);

	await db.insert(user).values({
		id,
		name,
		email,
		role: "owner",
	});

	return { id, name, email, role: "owner" };
}

async function createPendingInvite(
	ownerId: string,
	expiresAt = new Date(Date.now() + 60 * 60 * 1000),
) {
	const [invite] = await db
		.insert(tenantInvites)
		.values({
			name: "Test Tenant",
			email: `${crypto.randomUUID()}@test.keyhq.invalid`,
			token: crypto.randomUUID(),
			expiresAt,
			invitedById: ownerId,
			status: "pending",
		})
		.returning();

	if (!invite) {
		throw new Error("Failed to create test invite");
	}

	createdInviteIds.push(invite.id);
	return invite;
}

function clientFor(owner: Awaited<ReturnType<typeof createOwner>>) {
	mocks.getSession.mockResolvedValue({
		user: owner,
		session: { id: "test-session" },
	});

	return createRouterClient(
		{ resendInvite, createInvite },
		{
			context: {
				db,
				headers: new Headers(),
			},
		},
	);
}

afterEach(async () => {
	if (createdInviteIds.length > 0) {
		await db
			.delete(tenantInvites)
			.where(inArray(tenantInvites.id, createdInviteIds));
	}

	if (createdUserIds.length > 0) {
		await db.delete(user).where(inArray(user.id, createdUserIds));
	}

	createdInviteIds.length = 0;
	createdUserIds.length = 0;
	mocks.getSession.mockReset();
	mocks.sendInviteEmail.mockReset();
});

describe("resendInvite", () => {
	it("does not allow another owner to resend an invite", async () => {
		const ownerA = await createOwner("Owner A");
		const ownerB = await createOwner("Owner B");
		const invite = await createPendingInvite(ownerA.id);

		await expect(
			clientFor(ownerB).resendInvite({ inviteId: invite.id }),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
		});

		expect(mocks.sendInviteEmail).not.toHaveBeenCalled();

		const [storedInvite] = await db
			.select({ id: tenantInvites.id })
			.from(tenantInvites)
			.where(eq(tenantInvites.id, invite.id));

		expect(storedInvite).toBeDefined();
	});

	it("allows the inviting owner to resend a pending invite", async () => {
		const owner = await createOwner("Owner A");
		const invite = await createPendingInvite(owner.id);

		const result = await clientFor(owner).resendInvite({
			inviteId: invite.id,
		});

		expect(result).toEqual({
			deliveryStatus: "sent",
		});

		expect(mocks.sendInviteEmail).toHaveBeenCalledOnce();
		expect(mocks.sendInviteEmail).toHaveBeenCalledWith({
			to: invite.email,
			tenantName: invite.name,
			ownerName: owner.name,
			token: invite.token,
		});
	});
	it("expires an expired invite instead of sending it", async () => {
		const owner = await createOwner("Owner A");
		const invite = await createPendingInvite(
			owner.id,
			new Date(Date.now() - 60 * 1000),
		);

		await expect(
			clientFor(owner).resendInvite({ inviteId: invite.id }),
		).rejects.toMatchObject({
			code: "GONE",
		});

		expect(mocks.sendInviteEmail).not.toHaveBeenCalled();

		const [storedInvite] = await db
			.select({ status: tenantInvites.status })
			.from(tenantInvites)
			.where(eq(tenantInvites.id, invite.id));

		expect(storedInvite?.status).toBe("expired");
	});

	describe("createInvite", () => {
		it("preserves the pending invite when email delivery fails", async () => {
			const owner = await createOwner("Owner A");
			const email = `${crypto.randomUUID()}@test.keyhq.invalid`;

			mocks.sendInviteEmail.mockRejectedValueOnce(
				new Error("INVITE_EMAIL_DELIVERY_FAILED"),
			);

			const result = await clientFor(owner).createInvite({
				name: "Test Tenant",
				email,
			});

			createdInviteIds.push(result.invite.id);

			expect(result.deliveryStatus).toBe("failed");
			expect(mocks.sendInviteEmail).toHaveBeenCalledOnce();

			const [storedInvite] = await db
				.select({
					id: tenantInvites.id,
					status: tenantInvites.status,
					invitedById: tenantInvites.invitedById,
				})
				.from(tenantInvites)
				.where(eq(tenantInvites.id, result.invite.id));

			expect(storedInvite).toMatchObject({
				id: result.invite.id,
				status: "pending",
				invitedById: owner.id,
			});
		});
	});
});
