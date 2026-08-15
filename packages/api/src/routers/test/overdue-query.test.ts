import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import { user } from "@rently/db/schema/auth";
import {
	leases,
	notifications,
	payments,
	properties,
	units,
} from "@rently/db/schema/schema";
import { inArray } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
}));

vi.mock("@rently/auth", () => ({
	auth: {
		api: {
			getSession: mocks.getSession,
		},
	},
}));

import { queryOverdueLeases } from "../helpers/overdue-query";
import { listNotifications } from "../notification";

const db = createDb();
const created = {
	users: [] as string[],
	properties: [] as string[],
	units: [] as string[],
	leases: [] as string[],
	payments: [] as string[],
};

async function seedUser(role: "owner" | "tenant", name: string) {
	const id = crypto.randomUUID();
	created.users.push(id);
	const account = {
		id,
		name,
		email: `${id}@test.keyhq.invalid`,
		role,
	};
	await db.insert(user).values(account);
	return account;
}

async function seedLease(ownerId: string, tenantId: string, rentDueDate = 10) {
	const propertyId = crypto.randomUUID();
	const unitId = crypto.randomUUID();
	const leaseId = crypto.randomUUID();
	created.properties.push(propertyId);
	created.units.push(unitId);
	created.leases.push(leaseId);

	await db.insert(properties).values({
		id: propertyId,
		ownerId,
		name: `Property ${propertyId.slice(0, 6)}`,
		address: "1 Test Road",
		type: "residential",
	});
	await db.insert(units).values({
		id: unitId,
		propertyId,
		unitNumber: `A-${unitId.slice(0, 4)}`,
		type: "1BHK",
		baseRent: 100_000,
		status: "occupied",
	});
	await db.insert(leases).values({
		id: leaseId,
		unitId,
		tenantId,
		startDate: new Date("2026-01-01T00:00:00.000Z"),
		endDate: null,
		rent: 100_000,
		status: "active",
		rentDueDate,
	});

	return leaseId;
}

async function seedPayment(leaseId: string, amount: number) {
	const id = crypto.randomUUID();
	created.payments.push(id);
	await db.insert(payments).values({
		id,
		leaseId,
		amount,
		paymentDate: new Date("2026-08-05T00:00:00.000Z"),
		type: "rent",
	});
}

afterEach(async () => {
	if (created.users.length) {
		await db
			.delete(notifications)
			.where(inArray(notifications.userId, created.users));
	}
	if (created.payments.length) {
		await db.delete(payments).where(inArray(payments.id, created.payments));
	}
	if (created.leases.length) {
		await db.delete(leases).where(inArray(leases.id, created.leases));
	}
	if (created.units.length) {
		await db.delete(units).where(inArray(units.id, created.units));
	}
	if (created.properties.length) {
		await db
			.delete(properties)
			.where(inArray(properties.id, created.properties));
	}
	if (created.users.length) {
		await db.delete(user).where(inArray(user.id, created.users));
	}

	for (const key of Object.keys(created) as Array<keyof typeof created>) {
		created[key].length = 0;
	}
	mocks.getSession.mockReset();
	vi.useRealTimers();
});

describe("queryOverdueLeases", () => {
	it("is owner-scoped and reports partial rent outstanding", async () => {
		const owner = await seedUser("owner", "Owner A");
		const otherOwner = await seedUser("owner", "Owner B");
		const tenantA = await seedUser("tenant", "Tenant A");
		const tenantB = await seedUser("tenant", "Tenant B");
		const tenantC = await seedUser("tenant", "Tenant C");
		const tenantOther = await seedUser("tenant", "Tenant Other");

		const unpaidLease = await seedLease(owner.id, tenantA.id);
		const partialLease = await seedLease(owner.id, tenantB.id);
		const paidLease = await seedLease(owner.id, tenantC.id);
		await seedLease(otherOwner.id, tenantOther.id);

		await seedPayment(partialLease, 40_000);
		await seedPayment(paidLease, 100_000);
		const result = await queryOverdueLeases(
			db,
			new Date("2026-08-13T00:00:00.000Z"),
			owner.id,
		);

		expect(result).toHaveLength(2);
		expect(result).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					leaseId: unpaidLease,
					tenantId: tenantA.id,
					daysOverdue: 3,
					paidAmount: 0,
					outstandingAmount: 100_000,
				}),
				expect.objectContaining({
					leaseId: partialLease,
					tenantId: tenantB.id,
					daysOverdue: 3,
					paidAmount: 40_000,
					outstandingAmount: 60_000,
				}),
			]),
		);
	}, 30_000);
});

describe("overdue notifications", () => {
	it("creates one notification per lease and period", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-08-13T00:00:00.000Z"));

		const owner = await seedUser("owner", "Owner");
		const tenant = await seedUser("tenant", "Tenant");
		const leaseId = await seedLease(owner.id, tenant.id);

		mocks.getSession.mockResolvedValue({
			user: owner,
			session: { id: "test-session" },
		});

		const client = createRouterClient(
			{ listNotifications },
			{ context: { db, headers: new Headers() } },
		);

		const first = await client.listNotifications();
		const second = await client.listNotifications();

		const firstOverdue = first.notifications.filter(
			(notification) => notification.type === "rent_overdue",
		);
		const secondOverdue = second.notifications.filter(
			(notification) => notification.type === "rent_overdue",
		);

		expect(firstOverdue).toHaveLength(1);
		expect(secondOverdue).toHaveLength(1);
		expect(firstOverdue[0]).toMatchObject({
			entityId: leaseId,
			entityType: "rent_overdue:2026-08",
			title: "Rent payment overdue",
		});
	}, 30_000);
});
