import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import { account, user } from "@rently/db/schema/auth";
import {
	leaseAgreements,
	leases,
	paymentGroups,
	payments,
	properties,
	rentAllocations,
	rentCharges,
	tenantInvites,
	tenantProfiles,
	units,
} from "@rently/db/schema/schema";
import { and, eq, inArray, or } from "drizzle-orm";
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

import { getLeasePeriodDue } from "../helpers/period-balance";
import {
	acceptInvite,
	claimInvite,
	createInvite,
	getInviteByToken,
	resendInvite,
} from "../rent/invite";
import { createCombinedLease, createLease } from "../rent/lease";
import {
	createAgreementPayment,
	listPayments,
	voidPaymentGroup,
} from "../rent/payment";
import {
	createTenant,
	getTenantById,
	listTenants,
	updateTenant,
} from "../rent/tenant";

const db = createDb();
const createdUserIds: string[] = [];
const createdInviteIds: string[] = [];
const createdLeaseIds: string[] = [];
const createdAgreementIds: string[] = [];
const createdPaymentGroupIds: string[] = [];
const createdPaymentIds: string[] = [];
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

async function createRegisteredTenant(ownerId: string) {
	const id = crypto.randomUUID();
	const email = `${id}@test.keyhq.invalid`;

	createdUserIds.push(id);

	await db.insert(user).values({
		id,
		name: "Registered Tenant",
		email,
		role: "tenant",
	});

	await db.insert(tenantProfiles).values({
		userId: id,
		email,
		createdById: ownerId,
	});

	return { id, email };
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

function clientFor(authUser: {
	id: string;
	name: string;
	email: string;
	role: string;
}) {
	mocks.getSession.mockResolvedValue({
		user: authUser,
		session: { id: "test-session" },
	});

	return createRouterClient(
		{
			resendInvite,
			createInvite,
			claimInvite,
			getInviteByToken,
			acceptInvite,
			createTenant,
			listTenants,
			getTenantById,
			updateTenant,
			createLease,
			createCombinedLease,
			createAgreementPayment,
			listPayments,
			voidPaymentGroup,
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
	const createdTenantIds = [
		...new Set([...createdUserIds, ...createdInviteIds]),
	];

	// C04: the period ledger references leases — clear it first.
	await db
		.delete(rentAllocations)
		.where(
			inArray(
				rentAllocations.chargeId,
				db
					.select({ id: rentCharges.id })
					.from(rentCharges)
					.where(inArray(rentCharges.leaseId, createdLeaseIds)),
			),
		);
	await db
		.delete(rentCharges)
		.where(inArray(rentCharges.leaseId, createdLeaseIds));
	if (createdPaymentIds.length > 0) {
		await db.delete(payments).where(inArray(payments.id, createdPaymentIds));
	}

	if (createdPaymentGroupIds.length > 0) {
		await db
			.delete(paymentGroups)
			.where(inArray(paymentGroups.id, createdPaymentGroupIds));
	}

	if (createdLeaseIds.length > 0) {
		await db.delete(leases).where(inArray(leases.id, createdLeaseIds));
	}

	if (createdAgreementIds.length > 0) {
		await db
			.delete(leaseAgreements)
			.where(inArray(leaseAgreements.id, createdAgreementIds));
	}

	if (createdTenantIds.length > 0 || createdInviteIds.length > 0) {
		// Owner-prepared invitations create a provisional tenant profile immediately.
		// Remove it before its invitation, regardless of which test created the invite.
		await db
			.delete(tenantProfiles)
			.where(
				or(
					inArray(tenantProfiles.userId, createdTenantIds),
					inArray(tenantProfiles.invitedId, createdInviteIds),
				),
			);
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

	if (createdTenantIds.length > 0) {
		await db.delete(user).where(inArray(user.id, createdTenantIds));
	}

	createdInviteIds.length = 0;
	createdUserIds.length = 0;
	createdLeaseIds.length = 0;
	createdAgreementIds.length = 0;
	createdPaymentGroupIds.length = 0;
	createdPaymentIds.length = 0;
	createdUnitIds.length = 0;
	createdPropertyIds.length = 0;
	mocks.getSession.mockReset();
	mocks.passwordHash.mockReset();
	mocks.sendInviteEmail.mockReset();
});

describe("createInvite", () => {
	it("replaces expired and deleted pending invitations for the same owner", async () => {
		const owner = await createOwner("D05 Owner");
		const email = `${crypto.randomUUID()}@test.keyhq.invalid`;
		const [expiredInvite, deletedInvite] = await db
			.insert(tenantInvites)
			.values([
				{
					name: "Expired Tenant",
					email,
					token: crypto.randomUUID(),
					expiresAt: new Date(Date.now() - 60 * 1000),
					invitedById: owner.id,
					status: "pending",
				},
				{
					name: "Deleted Tenant",
					email,
					token: crypto.randomUUID(),
					expiresAt: new Date(Date.now() + 60 * 60 * 1000),
					invitedById: owner.id,
					status: "pending",
					deletedAt: new Date(),
				},
			])
			.returning();

		if (!expiredInvite || !deletedInvite) {
			throw new Error("Failed to create D05 invitation fixtures");
		}
		createdInviteIds.push(expiredInvite.id, deletedInvite.id);

		const result = await clientFor(owner).createInvite({
			name: "Replacement Tenant",
			email,
		});
		createdInviteIds.push(result.invite.id);

		expect(result.invite.email).toBe(email);
		expect(result.invite.status).toBe("pending");
	});

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
	it("creates one independent agreement linked to a registered tenant lease", async () => {
		const owner = await createOwner("Owner A");
		const tenant = await createRegisteredTenant(owner.id);

		const [property] = await db
			.insert(properties)
			.values({
				ownerId: owner.id,
				name: "Commercial Property",
				address: "1 Market Road",
				type: "commercial",
			})
			.returning();
		if (!property) throw new Error("Failed to create property fixture");
		createdPropertyIds.push(property.id);

		const [unit] = await db
			.insert(units)
			.values({
				propertyId: property.id,
				unitNumber: "Shop-1",
				type: "shop",
				baseRent: 1500,
				status: "available",
			})
			.returning();
		if (!unit) throw new Error("Failed to create unit fixture");
		createdUnitIds.push(unit.id);

		const startDate = new Date("2026-08-07T00:00:00.000Z");
		const endDate = new Date("2027-08-07T00:00:00.000Z");
		const { lease } = await clientFor(owner).createLease({
			unitId: unit.id,
			tenantId: tenant.id,
			startDate,
			endDate,
			rent: 1500,
			deposit: 100,
		});
		createdLeaseIds.push(lease.id);

		expect(lease.agreementId).not.toBeNull();
		if (!lease.agreementId) {
			throw new Error("Created lease must have an agreement ID");
		}
		createdAgreementIds.push(lease.agreementId);

		const agreements = await db
			.select({
				id: leaseAgreements.id,
				tenantId: leaseAgreements.tenantId,
				propertyId: leaseAgreements.propertyId,
				arrangementType: leaseAgreements.arrangementType,
				category: leaseAgreements.category,
				startDate: leaseAgreements.startDate,
				endDate: leaseAgreements.endDate,
			})
			.from(leaseAgreements)
			.where(
				and(
					eq(leaseAgreements.tenantId, tenant.id),
					eq(leaseAgreements.propertyId, property.id),
				),
			);

		expect(agreements).toEqual([
			{
				id: lease.agreementId,
				tenantId: tenant.id,
				propertyId: property.id,
				arrangementType: "independent",
				category: "commercial",
				startDate,
				endDate,
			},
		]);
	});

	it("creates one combined agreement for compatible available units", async () => {
		const owner = await createOwner("Owner A");
		const tenant = await createRegisteredTenant(owner.id);
		const [property] = await db
			.insert(properties)
			.values({
				ownerId: owner.id,
				name: "Combined Property",
				address: "2 Market Road",
				type: "residential",
			})
			.returning();
		if (!property) throw new Error("Failed to create property fixture");
		createdPropertyIds.push(property.id);

		const createdUnits = await db
			.insert(units)
			.values([
				{
					propertyId: property.id,
					unitNumber: "A-1",
					type: "1BHK",
					baseRent: 1200,
					status: "available",
				},
				{
					propertyId: property.id,
					unitNumber: "A-2",
					type: "2BHK",
					baseRent: 1800,
					status: "available",
				},
			])
			.returning();
		createdUnitIds.push(...createdUnits.map((unit) => unit.id));

		const { leases: createdLeases } = await clientFor(
			owner,
		).createCombinedLease({
			tenantId: tenant.id,
			startDate: new Date("2026-09-01T00:00:00.000Z"),
			endDate: new Date("2027-09-01T00:00:00.000Z"),
			units: createdUnits.map((unit) => ({
				unitId: unit.id,
				rent: unit.baseRent,
				deposit: unit.baseRent * 2,
			})),
		});
		createdLeaseIds.push(...createdLeases.map((lease) => lease.id));
		expect(createdLeases).toHaveLength(2);
		expect(new Set(createdLeases.map((lease) => lease.agreementId)).size).toBe(
			1,
		);
		const agreementId = createdLeases[0]?.agreementId;
		if (!agreementId) throw new Error("Combined leases need an agreement ID");
		createdAgreementIds.push(agreementId);

		const [agreement] = await db
			.select({
				arrangementType: leaseAgreements.arrangementType,
				category: leaseAgreements.category,
			})
			.from(leaseAgreements)
			.where(eq(leaseAgreements.id, agreementId));
		expect(agreement).toEqual({
			arrangementType: "combined",
			category: "residential",
		});
	});

	it("automatically splits a combined agreement payment across every unit", async () => {
		const owner = await createOwner("Owner A");
		const tenant = await createRegisteredTenant(owner.id);
		const [property] = await db
			.insert(properties)
			.values({
				ownerId: owner.id,
				name: "Payment Group Property",
				address: "3 Market Road",
				type: "residential",
			})
			.returning();
		if (!property) throw new Error("Failed to create property fixture");
		createdPropertyIds.push(property.id);

		const createdUnits = await db
			.insert(units)
			.values([
				{
					propertyId: property.id,
					unitNumber: "B-1",
					type: "1BHK",
					baseRent: 1100,
					status: "available",
				},
				{
					propertyId: property.id,
					unitNumber: "B-2",
					type: "2BHK",
					baseRent: 1900,
					status: "available",
				},
			])
			.returning();
		createdUnitIds.push(...createdUnits.map((unit) => unit.id));

		const client = clientFor(owner);
		const { leases: combinedLeases } = await client.createCombinedLease({
			tenantId: tenant.id,
			startDate: new Date("2026-09-01T00:00:00.000Z"),
			endDate: new Date("2027-09-01T00:00:00.000Z"),
			units: createdUnits.map((unit) => ({
				unitId: unit.id,
				rent: unit.baseRent,
			})),
		});
		createdLeaseIds.push(...combinedLeases.map((lease) => lease.id));
		const agreementId = combinedLeases[0]?.agreementId;
		if (!agreementId) throw new Error("Combined leases need an agreement ID");
		createdAgreementIds.push(agreementId);
		// C08: the group pays each lease's period outstanding.
		const dueByLease = await Promise.all(
			combinedLeases.map(
				async (lease) => (await getLeasePeriodDue(db, lease.id)).outstanding,
			),
		);

		const result = await client.createAgreementPayment({
			agreementId,
			paymentDate: new Date("2026-09-05T00:00:00.000Z"),
			paymentMethods: "upi",
			referenceNumber: "UPI-TEST-1",
			idempotencyKey: crypto.randomUUID(),
		});
		createdPaymentGroupIds.push(result.paymentGroup.id);
		createdPaymentIds.push(...result.payments.map((payment) => payment.id));

		expect(result.payments).toHaveLength(2);
		expect(
			new Set(result.payments.map((payment) => payment.paymentGroupId)),
		).toEqual(new Set([result.paymentGroup.id]));
		expect(result.payments.map((payment) => payment.amount).sort()).toEqual(
			dueByLease.sort(),
		);

		const reversal = await client.voidPaymentGroup({
			id: result.paymentGroup.id,
			reason: "Duplicate transfer",
		});
		createdPaymentGroupIds.push(reversal.paymentGroup.id);
		createdPaymentIds.push(...reversal.reversals.map((payment) => payment.id));
		expect(reversal.paymentGroup.reversesPaymentGroupId).toBe(
			result.paymentGroup.id,
		);
		expect(reversal.reversals.map((payment) => payment.amount).sort()).toEqual(
			dueByLease.map((amount) => -amount).sort(),
		);
	});

	it("creates an owner-prepared invitation with a provisional tenant identity", async () => {
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
		createdUserIds.push(result.invite.id);

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

		expect(tenantUser).toEqual({ id: result.invite.id });
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

	it("keeps a shared tenant as one owner-scoped relationship per owner", async () => {
		const ownerA = await createOwner("Owner A");
		const ownerB = await createOwner("Owner B");
		const email = `${crypto.randomUUID()}@test.keyhq.invalid`;

		const { invite: inviteA } = await clientFor(ownerA).createTenant({
			name: "Shared Tenant",
			email,
			address: "Owner A address",
		});
		const { invite: inviteB } = await clientFor(ownerB).createTenant({
			name: "Shared Tenant",
			email,
			address: "Owner B address",
		});
		createdInviteIds.push(inviteA.id, inviteB.id);
		createdUserIds.push(inviteA.id);

		const ownerATenants = await clientFor(ownerA).listTenants();
		const ownerBTenants = await clientFor(ownerB).listTenants();

		expect(ownerATenants.tenants).toHaveLength(1);
		expect(ownerBTenants.tenants).toHaveLength(1);
		expect(ownerATenants.tenants[0]?.inviteId).toBe(inviteA.id);
		expect(ownerBTenants.tenants[0]?.inviteId).toBe(inviteB.id);

		const [propertyA] = await db
			.insert(properties)
			.values({
				ownerId: ownerA.id,
				name: "Owner A Property",
				address: "Owner A Road",
				type: "residential",
			})
			.returning();
		const [propertyB] = await db
			.insert(properties)
			.values({
				ownerId: ownerB.id,
				name: "Owner B Property",
				address: "Owner B Road",
				type: "residential",
			})
			.returning();
		if (!propertyA || !propertyB)
			throw new Error("Failed to create properties");
		createdPropertyIds.push(propertyA.id, propertyB.id);

		const [unitA] = await db
			.insert(units)
			.values({
				propertyId: propertyA.id,
				unitNumber: "A-1",
				type: "1BHK",
				baseRent: 1500,
				status: "available",
			})
			.returning();
		const [unitB] = await db
			.insert(units)
			.values({
				propertyId: propertyB.id,
				unitNumber: "B-1",
				type: "1BHK",
				baseRent: 1500,
				status: "available",
			})
			.returning();
		if (!unitA || !unitB) throw new Error("Failed to create units");
		createdUnitIds.push(unitA.id, unitB.id);

		const { lease: leaseA } = await clientFor(ownerA).createLease({
			unitId: unitA.id,
			tenantId: inviteA.id,
			startDate: new Date("2026-08-07T00:00:00.000Z"),
			endDate: new Date("2027-08-07T00:00:00.000Z"),
			rent: 1500,
			deposit: 100,
		});
		const { lease: leaseB } = await clientFor(ownerB).createLease({
			unitId: unitB.id,
			tenantId: inviteA.id,
			startDate: new Date("2026-08-08T00:00:00.000Z"),
			endDate: new Date("2027-08-08T00:00:00.000Z"),
			rent: 1600,
			deposit: 100,
		});
		createdLeaseIds.push(leaseA.id, leaseB.id);
		if (leaseA.agreementId) createdAgreementIds.push(leaseA.agreementId);
		if (leaseB.agreementId) createdAgreementIds.push(leaseB.agreementId);

		const [paymentA] = await db
			.insert(payments)
			.values({
				leaseId: leaseA.id,
				amount: 140000,
				paymentDate: new Date("2026-09-04T00:00:00.000Z"),
				paymentMethods: "upi",
				type: "rent",
			})
			.returning();
		const [paymentB] = await db
			.insert(payments)
			.values({
				leaseId: leaseB.id,
				amount: 160000,
				paymentDate: new Date("2026-09-04T00:00:00.000Z"),
				paymentMethods: "upi",
				type: "rent",
			})
			.returning();
		if (!paymentA || !paymentB) throw new Error("Failed to create payments");
		createdPaymentIds.push(paymentA.id, paymentB.id);

		const ownerBPayments = await clientFor(ownerB).listPayments();
		expect(ownerBPayments.payments.map((payment) => payment.id)).toEqual([
			paymentB.id,
		]);

		const ownerBDetail = await clientFor(ownerB).getTenantById({
			id: inviteA.id,
		});
		expect(ownerBDetail.tenant.activeLeases.map((lease) => lease.id)).toEqual([
			leaseB.id,
		]);

		await clientFor(ownerB).updateTenant({
			tenantId: inviteA.id,
			address: "Owner B updated address",
		});

		const profiles = await db
			.select({
				createdById: tenantProfiles.createdById,
				address: tenantProfiles.address,
			})
			.from(tenantProfiles)
			.where(eq(tenantProfiles.userId, inviteA.id));

		expect(profiles).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					createdById: ownerA.id,
					address: "Owner A address",
				}),
				expect.objectContaining({
					createdById: ownerB.id,
					address: "Owner B updated address",
				}),
			]),
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
		expect(lease.agreementId).not.toBeNull();
		if (!lease.agreementId) {
			throw new Error("Created lease must have an agreement ID");
		}
		createdAgreementIds.push(lease.agreementId);

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

		const agreements = await db
			.select({
				id: leaseAgreements.id,
				tenantId: leaseAgreements.tenantId,
				propertyId: leaseAgreements.propertyId,
				arrangementType: leaseAgreements.arrangementType,
				category: leaseAgreements.category,
			})
			.from(leaseAgreements)
			.where(
				and(
					eq(leaseAgreements.tenantId, invite.id),
					eq(leaseAgreements.propertyId, property.id),
				),
			);

		expect(agreements).toEqual([
			{
				id: lease.agreementId,
				tenantId: invite.id,
				propertyId: property.id,
				arrangementType: "independent",
				category: "residential",
			},
		]);
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

describe("claimInvite", () => {
	// Regression rationale (Fix-Plan D06): an existing tenant was blocked by the
	// public account-creation flow, so a second owner could not establish their
	// own relationship without recreating or mutating the tenant's identity.
	it("claims exact pending invites for multiple owners without recreating the tenant", async () => {
		const ownerA = await createOwner("D06 Owner A");
		const ownerB = await createOwner("D06 Owner B");
		const ownerC = await createOwner("D06 Owner C");
		const tenant = {
			id: crypto.randomUUID(),
			name: "D06 Existing Tenant",
			email: `${crypto.randomUUID()}@test.keyhq.invalid`,
			role: "tenant",
		};
		createdUserIds.push(tenant.id);
		await db.insert(user).values(tenant);
		await db.insert(tenantProfiles).values({
			userId: tenant.id,
			email: tenant.email,
			address: "Owner A address",
			createdById: ownerA.id,
		});

		const { invite: inviteB } = await clientFor(ownerB).createInvite({
			name: tenant.name,
			email: tenant.email,
		});
		const { invite: inviteC } = await clientFor(ownerC).createInvite({
			name: tenant.name,
			email: tenant.email,
		});
		createdInviteIds.push(inviteB.id, inviteC.id);

		const inviteTokens = await db
			.select({ id: tenantInvites.id, token: tenantInvites.token })
			.from(tenantInvites)
			.where(
				or(eq(tenantInvites.id, inviteB.id), eq(tenantInvites.id, inviteC.id)),
			);
		const inviteTokenById = new Map(
			inviteTokens.map((invite) => [invite.id, invite.token]),
		);

		await clientFor(tenant).claimInvite({
			token: inviteTokenById.get(inviteC.id) ?? "",
		});
		await clientFor(tenant).claimInvite({
			token: inviteTokenById.get(inviteB.id) ?? "",
		});

		const profiles = await db
			.select({
				userId: tenantProfiles.userId,
				createdById: tenantProfiles.createdById,
				invitedId: tenantProfiles.invitedId,
				address: tenantProfiles.address,
			})
			.from(tenantProfiles)
			.where(eq(tenantProfiles.userId, tenant.id));
		expect(profiles).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					createdById: ownerA.id,
					address: "Owner A address",
				}),
				expect.objectContaining({
					createdById: ownerB.id,
					invitedId: inviteB.id,
				}),
				expect.objectContaining({
					createdById: ownerC.id,
					invitedId: inviteC.id,
				}),
			]),
		);

		const [storedB, storedC] = await db
			.select({ id: tenantInvites.id, status: tenantInvites.status })
			.from(tenantInvites)
			.where(
				or(eq(tenantInvites.id, inviteB.id), eq(tenantInvites.id, inviteC.id)),
			);
		expect([storedB, storedC]).toEqual(
			expect.arrayContaining([
				{ id: inviteB.id, status: "accepted" },
				{ id: inviteC.id, status: "accepted" },
			]),
		);

		const tenantRows = await db
			.select({ id: user.id, role: user.role })
			.from(user)
			.where(eq(user.email, tenant.email));
		expect(tenantRows).toEqual([{ id: tenant.id, role: "tenant" }]);
	});

	it("refuses a claim from a different authenticated email without writes", async () => {
		const owner = await createOwner("D06 Owner");
		const tenant = {
			id: crypto.randomUUID(),
			name: "D06 Tenant",
			email: `${crypto.randomUUID()}@test.keyhq.invalid`,
			role: "tenant",
		};
		const otherTenant = {
			id: crypto.randomUUID(),
			name: "D06 Other Tenant",
			email: `${crypto.randomUUID()}@test.keyhq.invalid`,
			role: "tenant",
		};
		createdUserIds.push(tenant.id, otherTenant.id);
		await db.insert(user).values([tenant, otherTenant]);

		const { invite } = await clientFor(owner).createInvite({
			name: tenant.name,
			email: tenant.email,
		});
		createdInviteIds.push(invite.id);
		const [storedInvite] = await db
			.select({ token: tenantInvites.token })
			.from(tenantInvites)
			.where(eq(tenantInvites.id, invite.id));

		await expect(
			clientFor(otherTenant).claimInvite({ token: storedInvite?.token ?? "" }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });

		const [inviteAfterClaim] = await db
			.select({ status: tenantInvites.status })
			.from(tenantInvites)
			.where(eq(tenantInvites.id, invite.id));
		expect(inviteAfterClaim?.status).toBe("pending");

		const profiles = await db
			.select({ id: tenantProfiles.id })
			.from(tenantProfiles)
			.where(eq(tenantProfiles.invitedId, invite.id));
		expect(profiles).toEqual([]);
	});

	it("reuses an owner-prepared relationship for an existing tenant", async () => {
		const owner = await createOwner("D06 Owner");
		const tenant = {
			id: crypto.randomUUID(),
			name: "D06 Existing Tenant",
			email: `${crypto.randomUUID()}@test.keyhq.invalid`,
			role: "tenant",
		};
		createdUserIds.push(tenant.id);
		await db.insert(user).values(tenant);

		const { invite } = await clientFor(owner).createTenant({
			name: tenant.name,
			email: tenant.email,
			address: "Owner prepared address",
		});
		createdInviteIds.push(invite.id);
		const [beforeClaim] = await db
			.select({ id: tenantProfiles.id, invitedId: tenantProfiles.invitedId })
			.from(tenantProfiles)
			.where(eq(tenantProfiles.invitedId, invite.id));
		expect(beforeClaim?.invitedId).toBe(invite.id);

		const [storedInvite] = await db
			.select({ token: tenantInvites.token })
			.from(tenantInvites)
			.where(eq(tenantInvites.id, invite.id));
		await clientFor(tenant).claimInvite({ token: storedInvite?.token ?? "" });

		const profiles = await db
			.select({ id: tenantProfiles.id, address: tenantProfiles.address })
			.from(tenantProfiles)
			.where(eq(tenantProfiles.invitedId, invite.id));
		expect(profiles).toEqual([
			{ id: beforeClaim?.id, address: "Owner prepared address" },
		]);
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
