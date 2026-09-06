// F02 durable notification deduplication — regression rationale:
// `listNotifications` lazily creates lease-expiry rows but deduped only on
// UNREAD rows, so reading one recreated it on the next poll (a duplicate
// pair of exactly this shape already exists in production-shaped dev data).
// Nothing arbitrated concurrent polls either. The fix dedupes by
// (user, type, entity, period) regardless of read state, with a partial
// unique index as the race arbiter — so a new month still notifies anew.
import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import { NOTIFICATION_TYPES } from "@rently/db/constants/notification-constants";
import {
	PROPERTY_TYPES,
	UNIT_TYPES,
} from "@rently/db/constants/rent-constants";
import { user } from "@rently/db/schema/auth";
import {
	leaseAgreements,
	leases,
	notifications,
	properties,
	rentAllocations,
	rentCharges,
	tenantProfiles,
	units,
} from "@rently/db/schema/schema";
import { and, eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
}));

vi.mock("@rently/auth", () => ({
	auth: { api: { getSession: mocks.getSession } },
}));

import { listNotifications, markAsRead } from "../notification";
import { createLease } from "../rent/lease";

const db = createDb();

const createdUserIds: string[] = [];
const createdProfileIds: string[] = [];
const createdPropertyIds: string[] = [];
const createdUnitIds: string[] = [];
const createdLeaseIds: string[] = [];
const createdAgreementIds: string[] = [];
const createdNotificationIds: string[] = [];

const RENT = 10_000_00;

async function ownerWithLease(options: { startDate: Date; endDate: Date }) {
	const ownerId = crypto.randomUUID();
	createdUserIds.push(ownerId);
	await db.insert(user).values({
		id: ownerId,
		name: "Owner A",
		email: `${ownerId}@test.keyhq.invalid`,
		role: "owner",
	});
	const tenantId = crypto.randomUUID();
	createdUserIds.push(tenantId);
	await db.insert(user).values({
		id: tenantId,
		name: "Tenant A",
		email: `${tenantId}@test.keyhq.invalid`,
		role: "tenant",
	});
	const profileId = crypto.randomUUID();
	createdProfileIds.push(profileId);
	await db.insert(tenantProfiles).values({
		id: profileId,
		userId: tenantId,
		createdById: ownerId,
	});
	const propertyId = crypto.randomUUID();
	createdPropertyIds.push(propertyId);
	await db.insert(properties).values({
		id: propertyId,
		ownerId,
		name: "Palm Residency",
		address: "1 Palm Road, Mumbai",
		type: PROPERTY_TYPES.RESIDENTIAL,
	});
	const unitId = crypto.randomUUID();
	createdUnitIds.push(unitId);
	await db.insert(units).values({
		id: unitId,
		propertyId,
		unitNumber: `F02-${unitId.slice(0, 4)}`,
		type: UNIT_TYPES.ONEBHK,
		baseRent: RENT,
		status: "available",
	});
	mocks.getSession.mockResolvedValue({
		user: { id: ownerId, role: "owner" },
		session: { id: "test-session" },
	});
	const context = { db, headers: new Headers() } as never;
	const api = createRouterClient(
		{ createLease, listNotifications, markAsRead },
		{ context },
	);
	const created = await api.createLease({
		unitId,
		tenantId,
		startDate: options.startDate,
		endDate: options.endDate,
		rent: RENT,
	});
	if (!created.lease.agreementId) throw new Error("Lease created no agreement");
	createdAgreementIds.push(created.lease.agreementId);
	createdLeaseIds.push(created.lease.id);
	return { api, ownerId, leaseId: created.lease.id };
}

async function expiryRows(leaseId: string) {
	return db
		.select({ id: notifications.id, isRead: notifications.isRead })
		.from(notifications)
		.where(
			and(
				eq(notifications.entityId, leaseId),
				eq(notifications.type, NOTIFICATION_TYPES.LEASE_EXPIRING_SOON),
			),
		);
}

async function overdueRows(leaseId: string) {
	return db
		.select({ id: notifications.id, entityType: notifications.entityType })
		.from(notifications)
		.where(
			and(
				eq(notifications.entityId, leaseId),
				eq(notifications.type, NOTIFICATION_TYPES.RENT_OVERDUE),
			),
		);
}

function trackNotification(id: string) {
	if (!createdNotificationIds.includes(id)) createdNotificationIds.push(id);
}

async function ownerOf(notificationId: string) {
	const [row] = await db
		.select({ userId: notifications.userId })
		.from(notifications)
		.where(eq(notifications.id, notificationId));
	if (!row) throw new Error("Notification row missing");
	return row.userId;
}

afterEach(async () => {
	if (createdNotificationIds.length > 0) {
		await db
			.delete(notifications)
			.where(inArray(notifications.id, createdNotificationIds));
	}
	if (createdLeaseIds.length > 0) {
		const strays = await db
			.select({ id: notifications.id })
			.from(notifications)
			.where(inArray(notifications.entityId, createdLeaseIds));
		for (const stray of strays) trackNotification(stray.id);
		if (createdNotificationIds.length > 0) {
			await db
				.delete(notifications)
				.where(inArray(notifications.id, createdNotificationIds));
		}
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
		await db.delete(leases).where(inArray(leases.id, createdLeaseIds));
	}
	if (createdAgreementIds.length > 0) {
		await db
			.delete(notifications)
			.where(inArray(notifications.entityId, createdAgreementIds));
		await db
			.delete(leaseAgreements)
			.where(inArray(leaseAgreements.id, createdAgreementIds));
	}
	if (createdUnitIds.length > 0) {
		await db.delete(units).where(inArray(units.id, createdUnitIds));
	}
	if (createdPropertyIds.length > 0) {
		await db
			.delete(properties)
			.where(inArray(properties.id, createdPropertyIds));
	}
	if (createdProfileIds.length > 0) {
		await db
			.delete(tenantProfiles)
			.where(inArray(tenantProfiles.id, createdProfileIds));
	}
	if (createdUserIds.length > 0) {
		await db.delete(user).where(inArray(user.id, createdUserIds));
	}
	createdNotificationIds.length = 0;
	createdLeaseIds.length = 0;
	createdAgreementIds.length = 0;
	createdUnitIds.length = 0;
	createdPropertyIds.length = 0;
	createdProfileIds.length = 0;
	createdUserIds.length = 0;
	mocks.getSession.mockReset();
});

describe("F02 notification deduplication", () => {
	it("does not recreate a lease-expiry notification after it is read", async () => {
		const now = Date.now();
		const { api, leaseId } = await ownerWithLease({
			startDate: new Date("2026-01-01T00:00:00.000Z"),
			endDate: new Date(now + 10 * 24 * 60 * 60 * 1000),
		});

		await api.listNotifications();
		const [first] = await expiryRows(leaseId);
		if (!first) throw new Error("Expected one expiry notification");
		trackNotification(first.id);

		await api.markAsRead({ id: first.id });
		await api.listNotifications();

		expect(await expiryRows(leaseId)).toHaveLength(1);
	});

	it("creates one expiry row under concurrent polls", async () => {
		const now = Date.now();
		const { api, leaseId } = await ownerWithLease({
			startDate: new Date("2026-01-01T00:00:00.000Z"),
			endDate: new Date(now + 10 * 24 * 60 * 60 * 1000),
		});

		await Promise.all([
			api.listNotifications(),
			api.listNotifications(),
			api.listNotifications(),
			api.listNotifications(),
		]);

		const rows = await expiryRows(leaseId);
		for (const row of rows) trackNotification(row.id);
		expect(rows).toHaveLength(1);

		// The polls above serialize on this driver, so pin the race arbiter
		// itself: a raw duplicate of the same identity must be refused.
		let code: unknown;
		try {
			await db.insert(notifications).values({
				userId: rows[0] ? await ownerOf(rows[0].id) : "",
				type: NOTIFICATION_TYPES.LEASE_EXPIRING_SOON,
				title: "Lease expiring soon",
				message: "Duplicate probe.",
				entityId: leaseId,
				entityType: "lease",
			});
		} catch (error) {
			const top = error as { code?: unknown; cause?: { code?: unknown } };
			code = top.code ?? top.cause?.code;
		}
		expect(code).toBe("23505");
	});

	it("notifies a new overdue period without duplicating the old one", async () => {
		// Backdated start accrues past-due period charges, so the lease reads
		// as overdue for the current month.
		const { api, ownerId, leaseId } = await ownerWithLease({
			startDate: new Date("2026-04-01T00:00:00.000Z"),
			endDate: new Date("2027-12-01T00:00:00.000Z"),
		});
		const [seeded] = await db
			.insert(notifications)
			.values({
				userId: ownerId,
				type: NOTIFICATION_TYPES.RENT_OVERDUE,
				title: "Rent payment overdue",
				message: "Seeded last-period overdue notice.",
				entityId: leaseId,
				entityType: "rent_overdue:2020-01",
			})
			.returning();
		if (!seeded) throw new Error("Seeding failed");
		trackNotification(seeded.id);

		await api.listNotifications();

		const rows = await overdueRows(leaseId);
		for (const row of rows) trackNotification(row.id);
		// One row per period: the seeded old one plus exactly one current.
		expect(rows).toHaveLength(2);
		expect(
			rows.filter((row) => row.entityType !== "rent_overdue:2020-01"),
		).toHaveLength(1);
	});
});
