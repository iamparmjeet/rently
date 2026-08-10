import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import { account, user } from "@rently/db/schema/auth";
import {
	leases,
	properties,
	tenantInvites,
	tenantProfiles,
	units,
} from "@rently/db/schema/schema";
import { eq, inArray } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
	sendInviteEmail: vi.fn(),
	passwordHash: vi.fn(),
}));

vi.mock("@rently/auth", () => ({
	auth: {
		api: {
			getSession: mocks.getSession,
		},
		$context: Promise.resolve({
			password: {
				hash: mocks.passwordHash,
			},
		}),
	},
}));

vi.mock("@rently/email", () => ({
	sendInviteEmail: mocks.sendInviteEmail,
}));

import {
	acceptInvite,
	createInvite,
	getInviteByToken,
	resendInvite,
} from "../rent/invite";
import { createLease } from "../rent/lease";
import { createTenant, listTenants } from "../rent/tenant";

const db = createDb();
const createdUserIds: string[] = [];
const createdInviteIds: string[] = [];
const createdLeaseIds: string[] = [];
const createdUnitIds: string[] = [];
const createdPropertyIds: string[] = [];

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

async function createOwnerPreparedInvite(ownerId: string) {
	const invite = await createPendingInvite(ownerId);

	const [ownerPreparedInvite] = await db
		.update(tenantInvites)
		.set({
			onboardingMode: "owner_prepared",
			phone: "9123456789",
			address: "99 Owner Prepared Road",
			emergencyContact: "Owner Emergency Contact",
			emergencyContactName: "Morgan Contact",
			emergencyContactLocation: "Mumbai",
		})
		.where(eq(tenantInvites.id, invite.id))
		.returning();

	if (!ownerPreparedInvite) {
		throw new Error("Failed to prepare owner-prepared test invite");
	}

	return ownerPreparedInvite;
}

function clientFor(owner: Awaited<ReturnType<typeof createOwner>>) {
	mocks.getSession.mockResolvedValue({
		user: owner,
		session: { id: "test-session" },
	});

	return createRouterClient(
		{
			resendInvite,
			createInvite,
			getInviteByToken,
			acceptInvite,
			createTenant,
			listTenants,
			createLease,
		},
		{
			context: {
				db,
				headers: new Headers(),
			},
		},
	);
}

beforeEach(() => {
	mocks.passwordHash.mockResolvedValue("test-password-hash");
});

afterEach(async () => {
	if (createdLeaseIds.length > 0) {
		await db.delete(leases).where(inArray(leases.id, createdLeaseIds));
	}

	if (createdUserIds.length > 0) {
		await db
			.delete(tenantProfiles)
			.where(inArray(tenantProfiles.userId, createdUserIds));
	}

	if (createdInviteIds.length > 0) {
		await db
			.delete(tenantInvites)
			.where(inArray(tenantInvites.id, createdInviteIds));
	}

	if (createdUnitIds.length > 0) {
		await db.delete(units).where(inArray(units.id, createdUnitIds));
	}

	if (createdPropertyIds.length > 0) {
		await db
			.delete(properties)
			.where(inArray(properties.id, createdPropertyIds));
	}

	if (createdUserIds.length > 0) {
		await db.delete(user).where(inArray(user.id, createdUserIds));
	}

	createdInviteIds.length = 0;
	createdUserIds.length = 0;
	createdLeaseIds.length = 0;
	createdUnitIds.length = 0;
	createdPropertyIds.length = 0;
	mocks.getSession.mockReset();
	mocks.passwordHash.mockReset();
	mocks.sendInviteEmail.mockReset();
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
				deliveryStatus: tenantInvites.deliveryStatus,
				lastSentAt: tenantInvites.lastSentAt,
				deliveryErrorCode: tenantInvites.deliveryErrorCode,
			})
			.from(tenantInvites)
			.where(eq(tenantInvites.id, result.invite.id));

		expect(storedInvite).toMatchObject({
			id: result.invite.id,
			status: "pending",
			invitedById: owner.id,
			deliveryStatus: "failed",
			lastSentAt: null,
			deliveryErrorCode: "unknown",
		});
	});
});

describe("createTenant", () => {
	it("creates an owner-prepared invitation without creating a Better Auth user", async () => {
		const owner = await createOwner("Owner A");
		const email = `${crypto.randomUUID()}@test.keyhq.invalid`;

		const result = await clientFor(owner).createTenant({
			name: "Prepared Tenant",
			email,
			phone: "9123456789",
			address: "99 Owner Prepared Road",
			emergencyContact: "Owner Emergency Contact",
			emergencyContactName: "Morgan Contact",
			emergencyContactLocation: "Mumbai",
		});

		createdInviteIds.push(result.invite.id);

		expect(result.deliveryStatus).toBe("sent");

		const [storedInvite] = await db
			.select({
				status: tenantInvites.status,
				onboardingMode: tenantInvites.onboardingMode,
				phone: tenantInvites.phone,
				address: tenantInvites.address,
				emergencyContact: tenantInvites.emergencyContact,
				emergencyContactName: tenantInvites.emergencyContactName,
				emergencyContactLocation: tenantInvites.emergencyContactLocation,
			})
			.from(tenantInvites)
			.where(eq(tenantInvites.id, result.invite.id));

		expect(storedInvite).toEqual({
			status: "pending",
			onboardingMode: "owner_prepared",
			phone: "9123456789",
			address: "99 Owner Prepared Road",
			emergencyContact: "Owner Emergency Contact",
			emergencyContactName: "Morgan Contact",
			emergencyContactLocation: "Mumbai",
		});

		const [tenantUser] = await db
			.select({ id: user.id })
			.from(user)
			.where(eq(user.email, email));

		expect(tenantUser).toBeUndefined();
	});

	it("lists a newly created invitation as an unverified pending tenant", async () => {
		const owner = await createOwner("Owner A");
		const email = `${crypto.randomUUID()}@test.keyhq.invalid`;

		const { invite } = await clientFor(owner).createTenant({
			name: "Prepared Tenant",
			email,
		});
		createdInviteIds.push(invite.id);

		const { tenants } = await clientFor(owner).listTenants();

		expect(tenants).toContainEqual(
			expect.objectContaining({
				id: invite.id,
				inviteId: invite.id,
				email,
				status: "pending",
				emailVerified: false,
			}),
		);
	});

	it("allows an owner to create a lease for an unverified owner-prepared tenant", async () => {
		const owner = await createOwner("Owner A");
		const email = `${crypto.randomUUID()}@test.keyhq.invalid`;
		const { invite } = await clientFor(owner).createTenant({
			name: "Prepared Tenant",
			email,
			phone: "9123456789",
		});
		createdInviteIds.push(invite.id);

		const [property] = await db
			.insert(properties)
			.values({
				ownerId: owner.id,
				name: "Test Property",
				address: "1 Test Road",
				type: "residential",
			})
			.returning();
		if (!property) throw new Error("Failed to create property fixture");
		createdPropertyIds.push(property.id);

		const [unit] = await db
			.insert(units)
			.values({
				propertyId: property.id,
				unitNumber: "A-1",
				type: "1BHK",
				baseRent: 1500,
				status: "available",
			})
			.returning();
		if (!unit) throw new Error("Failed to create unit fixture");
		createdUnitIds.push(unit.id);

		const { lease } = await clientFor(owner).createLease({
			unitId: unit.id,
			tenantId: invite.id,
			startDate: new Date("2026-08-07T00:00:00.000Z"),
			endDate: new Date("2027-08-07T00:00:00.000Z"),
			rent: 1500,
			deposit: 100,
		});
		createdLeaseIds.push(lease.id);
		createdUserIds.push(invite.id);

		expect(lease.tenantId).toBe(invite.id);

		const [provisionalUser] = await db
			.select({
				id: user.id,
				emailVerified: user.emailVerified,
				role: user.role,
			})
			.from(user)
			.where(eq(user.id, invite.id));

		expect(provisionalUser).toEqual({
			id: invite.id,
			emailVerified: false,
			role: "tenant",
		});
	});
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

		const [storedInvite] = await db
			.select({
				deliveryStatus: tenantInvites.deliveryStatus,
				lastSentAt: tenantInvites.lastSentAt,
				deliveryErrorCode: tenantInvites.deliveryErrorCode,
			})
			.from(tenantInvites)
			.where(eq(tenantInvites.id, invite.id));

		expect(storedInvite?.deliveryStatus).toBe("sent");
		expect(storedInvite?.lastSentAt).toBeInstanceOf(Date);
		expect(storedInvite?.deliveryErrorCode).toBeNull();
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
});

describe("getInviteByToken", () => {
	it("marks an expired token as expired and does not expose it", async () => {
		const owner = await createOwner("Owner A");
		const invite = await createPendingInvite(
			owner.id,
			new Date(Date.now() - 60 * 1000),
		);

		await expect(
			clientFor(owner).getInviteByToken({ token: invite.token }),
		).rejects.toMatchObject({
			code: "GONE",
		});

		const [storedInvite] = await db
			.select({ status: tenantInvites.status })
			.from(tenantInvites)
			.where(eq(tenantInvites.id, invite.id));

		expect(storedInvite?.status).toBe("expired");
	});
});

describe("acceptInvite", () => {
	it("accepts a tenant-completed invite with consent and a verified tenant account", async () => {
		const owner = await createOwner("Owner A");
		const invite = await createPendingInvite(owner.id);

		const result = await clientFor(owner).acceptInvite({
			token: invite.token,
			password: "TenantPass1",
			termsAccepted: true,
			privacyAcknowledged: true,
			phone: "9876543210",
			address: "12 Test Street",
			emergencyContact: "Emergency Contact",
			emergencyContactName: "Alex Contact",
			emergencyContactLocation: "Bengaluru",
		});

		expect(result).toEqual({
			success: true,
			message: "Account created successfully! Please log in with your email.",
		});
		expect(mocks.passwordHash).toHaveBeenCalledWith("TenantPass1");

		const [tenantUser] = await db
			.select({
				id: user.id,
				email: user.email,
				emailVerified: user.emailVerified,
				role: user.role,
			})
			.from(user)
			.where(eq(user.email, invite.email));

		expect(tenantUser).toMatchObject({
			email: invite.email,
			emailVerified: true,
			role: "tenant",
		});

		if (!tenantUser) {
			throw new Error("Accepted tenant user was not created");
		}

		createdUserIds.push(tenantUser.id);

		const [credential] = await db
			.select({
				userId: account.userId,
				providerId: account.providerId,
				password: account.password,
			})
			.from(account)
			.where(eq(account.userId, tenantUser.id));

		expect(credential).toEqual({
			userId: tenantUser.id,
			providerId: "credential",
			password: "test-password-hash",
		});

		const [profile] = await db
			.select({
				userId: tenantProfiles.userId,
				phone: tenantProfiles.phone,
				address: tenantProfiles.address,
				emergencyContact: tenantProfiles.emergencyContact,
				emergencyContactName: tenantProfiles.emergencyContactName,
				emergencyContactLocation: tenantProfiles.emergencyContactLocation,
				aadhaarLastFour: tenantProfiles.aadhaarLastFour,
				invitedId: tenantProfiles.invitedId,
				createdById: tenantProfiles.createdById,
			})
			.from(tenantProfiles)
			.where(eq(tenantProfiles.userId, tenantUser.id));

		expect(profile).toEqual({
			userId: tenantUser.id,
			phone: "9876543210",
			address: "12 Test Street",
			emergencyContact: "Emergency Contact",
			emergencyContactName: "Alex Contact",
			emergencyContactLocation: "Bengaluru",
			aadhaarLastFour: null,
			invitedId: invite.id,
			createdById: owner.id,
		});

		const [storedInvite] = await db
			.select({
				status: tenantInvites.status,
				termsAcceptedAt: tenantInvites.termsAcceptedAt,
				termsVersion: tenantInvites.termsVersion,
				privacyAcknowledgedAt: tenantInvites.privacyAcknowledgedAt,
				privacyVersion: tenantInvites.privacyVersion,
			})
			.from(tenantInvites)
			.where(eq(tenantInvites.id, invite.id));

		expect(storedInvite?.status).toBe("accepted");
		expect(storedInvite?.termsAcceptedAt).toBeInstanceOf(Date);
		expect(storedInvite?.termsVersion).toBe("keyhq-beta-v1");
		expect(storedInvite?.privacyAcknowledgedAt).toBeInstanceOf(Date);
		expect(storedInvite?.privacyVersion).toBe("keyhq-beta-v1");
	});

	it("uses owner-prepared profile fields without collecting identity values", async () => {
		const owner = await createOwner("Owner A");
		const invite = await createOwnerPreparedInvite(owner.id);

		await clientFor(owner).acceptInvite({
			token: invite.token,
			password: "TenantPass1",
			termsAccepted: true,
			privacyAcknowledged: true,
		});

		const [tenantUser] = await db
			.select({
				id: user.id,
				emailVerified: user.emailVerified,
				role: user.role,
			})
			.from(user)
			.where(eq(user.email, invite.email));

		expect(tenantUser).toMatchObject({
			emailVerified: true,
			role: "tenant",
		});

		if (!tenantUser) {
			throw new Error("Accepted tenant user was not created");
		}

		createdUserIds.push(tenantUser.id);

		const [profile] = await db
			.select({
				phone: tenantProfiles.phone,
				address: tenantProfiles.address,
				emergencyContact: tenantProfiles.emergencyContact,
				emergencyContactName: tenantProfiles.emergencyContactName,
				emergencyContactLocation: tenantProfiles.emergencyContactLocation,
				aadhaarLastFour: tenantProfiles.aadhaarLastFour,
			})
			.from(tenantProfiles)
			.where(eq(tenantProfiles.userId, tenantUser.id));

		expect(profile).toEqual({
			phone: "9123456789",
			address: "99 Owner Prepared Road",
			emergencyContact: "Owner Emergency Contact",
			emergencyContactName: "Morgan Contact",
			emergencyContactLocation: "Mumbai",
			aadhaarLastFour: null,
		});
	});
	it("does not create a duplicate account during acceptance", async () => {
		const owner = await createOwner("Owner A");
		const existingTenant = await createOwner("Existing Tenant");
		const invite = await createPendingInvite(owner.id);
		await db
			.update(tenantInvites)
			.set({ email: existingTenant.email })
			.where(eq(tenantInvites.id, invite.id));

		await expect(
			clientFor(owner).acceptInvite({
				token: invite.token,
				password: "TenantPass1",
				termsAccepted: true,
				privacyAcknowledged: true,
			}),
		).rejects.toMatchObject({ code: "CONFLICT" });

		const [orphanedUser] = await db
			.select({ id: user.id })
			.from(user)
			.where(eq(user.email, existingTenant.email));

		expect(orphanedUser?.id).toBe(existingTenant.id);

		const [storedInvite] = await db
			.select({ status: tenantInvites.status })
			.from(tenantInvites)
			.where(eq(tenantInvites.id, invite.id));

		expect(storedInvite?.status).toBe("pending");
	});

	it("rejects acceptance without the required consent and creates no account", async () => {
		const owner = await createOwner("Owner A");
		const invite = await createPendingInvite(owner.id);

		const input: unknown = {
			token: invite.token,
			password: "TenantPass1",
			termsAccepted: false,
			privacyAcknowledged: true,
		};

		await expect(
			clientFor(owner).acceptInvite(input as never),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});

		expect(mocks.passwordHash).not.toHaveBeenCalled();

		const [tenantUser] = await db
			.select({ id: user.id })
			.from(user)
			.where(eq(user.email, invite.email));

		expect(tenantUser).toBeUndefined();
	});

	it("rejects tenant attempts to override owner-prepared profile fields", async () => {
		const owner = await createOwner("Owner A");
		const invite = await createOwnerPreparedInvite(owner.id);

		await expect(
			clientFor(owner).acceptInvite({
				token: invite.token,
				password: "TenantPass1",
				termsAccepted: true,
				privacyAcknowledged: true,
				phone: "0000000000",
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});

		const [tenantUser] = await db
			.select({ id: user.id })
			.from(user)
			.where(eq(user.email, invite.email));

		expect(tenantUser).toBeUndefined();
	});

	it("rejects an expired invitation without creating an account", async () => {
		const owner = await createOwner("Owner A");
		const invite = await createPendingInvite(
			owner.id,
			new Date(Date.now() - 60 * 1000),
		);

		await expect(
			clientFor(owner).acceptInvite({
				token: invite.token,
				password: "TenantPass1",
				termsAccepted: true,
				privacyAcknowledged: true,
			}),
		).rejects.toMatchObject({
			code: "GONE",
		});

		const [tenantUser] = await db
			.select({ id: user.id })
			.from(user)
			.where(eq(user.email, invite.email));

		expect(tenantUser).toBeUndefined();
	});
});
