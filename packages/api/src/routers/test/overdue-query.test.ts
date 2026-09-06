import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import { user } from "@rently/db/schema/auth";
import {
	leases,
	notifications,
	payments,
	properties,
	rentAllocations,
	rentCharges,
	units,
} from "@rently/db/schema/schema";
import { inArray } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

// C08 cutover tests for the overdue report. Per the AGENTS.md test rule,
// each case pins a regression:
// - overdue state derives from stored charges (seeded directly, so the real
//   clock's lazy accrual cannot pollute fake-date assertions);
// - the earliest overdue charge anchors the state while arrears aggregate —
//   a backdated lease surfaces as ONE overdue entry, never a per-period
//   burst (R13);
// - owner scoping holds (E01-class) and settled charges do not appear;
// - the in-app notification dedupes per lease + period (one poll, one row).
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
	charges: [] as string[],
	allocations: [] as string[],
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

// Direct charge seeding (deterministic regardless of the real clock).
async function seedCharge(
	leaseId: string,
	periodKey: string,
	dueDate: string,
	amount: number,
	outstandingAfter = 0,
) {
	const chargeId = crypto.randomUUID();
	created.charges.push(chargeId);
	await db.insert(rentCharges).values({
		id: chargeId,
		leaseId,
		periodKey,
		dueDate,
		amount,
	});
	const settled = amount - outstandingAfter;
	if (settled > 0) {
		const paymentId = crypto.randomUUID();
		created.payments.push(paymentId);
		await db.insert(payments).values({
			id: paymentId,
			leaseId,
			amount: settled,
			paymentDate: new Date(`${dueDate}T00:00:00.000Z`),
			type: "rent",
		});
		const allocationId = crypto.randomUUID();
		created.allocations.push(allocationId);
		await db.insert(rentAllocations).values({
			id: allocationId,
			chargeId,
			paymentId,
			amount: settled,
		});
	}
	return chargeId;
}

afterEach(async () => {
	if (created.users.length) {
		await db
			.delete(notifications)
			.where(inArray(notifications.userId, created.users));
	}
	if (created.allocations.length) {
		await db
			.delete(rentAllocations)
			.where(inArray(rentAllocations.id, created.allocations));
	}
	if (created.charges.length) {
		await db
			.delete(rentCharges)
			.where(inArray(rentCharges.id, created.charges));
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
	it("is owner-scoped, aggregates arrears onto one entry, and skips settled charges", async () => {
		const owner = await seedUser("owner", "Owner A");
		const otherOwner = await seedUser("owner", "Owner B");
		const tenantA = await seedUser("tenant", "Tenant A");
		const tenantB = await seedUser("tenant", "Tenant B");
		const tenantC = await seedUser("tenant", "Tenant C");
		const tenantOther = await seedUser("tenant", "Tenant Other");

		// Arrears lease: July fully owed + August partially paid (40k of 100k).
		const arrearsLease = await seedLease(owner.id, tenantA.id);
		await seedCharge(arrearsLease, "2026-07", "2026-07-10", 100_000, 100_000);
		await seedCharge(arrearsLease, "2026-08", "2026-08-10", 100_000, 60_000);
		// Settled lease: its only charge is fully allocated.
		const settledLease = await seedLease(owner.id, tenantB.id);
		await seedCharge(settledLease, "2026-08", "2026-08-10", 100_000, 0);
		await seedLease(owner.id, tenantC.id); // no charges yet
		const foreignLease = await seedLease(otherOwner.id, tenantOther.id);
		await seedCharge(foreignLease, "2026-07", "2026-07-10", 100_000, 100_000);

		const result = await queryOverdueLeases(
			db,
			new Date("2026-08-13T00:00:00.000Z"),
			owner.id,
		);

		// One aggregated entry for the arrears lease (never a per-period burst).
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			leaseId: arrearsLease,
			tenantId: tenantA.id,
			paidAmount: 40_000,
			outstandingAmount: 160_000,
			// Anchored on the earliest overdue charge (July 10).
			dueDate: "2026-07-10",
			daysOverdue: 34,
		});
	});
});

describe("overdue notifications", () => {
	it("creates one notification per lease and period", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-08-13T00:00:00.000Z"));

		const owner = await seedUser("owner", "Owner");
		const tenant = await seedUser("tenant", "Tenant");
		const leaseId = await seedLease(owner.id, tenant.id);
		await seedCharge(leaseId, "2026-08", "2026-08-10", 100_000, 100_000);

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
