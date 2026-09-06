import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import { LEASE_STATUSES } from "@rently/db/constants/rent-constants";
import { user } from "@rently/db/schema/auth";
import {
	leaseAgreements,
	leases,
	properties,
	rentAllocations,
	rentCharges,
	tenantInvites,
	tenantProfiles,
	units,
} from "@rently/db/schema/schema";
import { plans, subscriptions } from "@rently/db/schema/subscription";
import { and, eq, inArray, or } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

// Regression rationale (Fix-Plan D04 — "no activation path can exceed the plan"):
// Before this slice the plan's tenant limit was enforced ONLY at invite
// creation, via a racy read-then-write count, and lease activation checked
// nothing at all — any owner could exceed the plan through createLease,
// createCombinedLease, or terminated-lease reactivation, and two concurrent
// activations could both pass a count-and-check. These tests pin:
//   1. concurrent activations on a full plan: exactly one succeeds (node tx),
//   2. the same on the Neon batch path (assert is batch[0]),
//   3. multi-lease/combined activations of an already-active tenant are
//      seat-neutral (a seat is a DISTINCT tenant per owner, not per lease),
//   4. reactivation is an activation (refused when full, allowed after a seat
//      frees),
//   5. removing a tenant's last relationship frees the seat (derived count,
//      no seat ledger),
//   6. pending invites are quotaed SEPARATELY from active seats, ignoring
//      expired rows,
//   7. the behavior change: invite creation no longer checks active seats,
//   8. the seat-guard SQL itself: exclusion semantics, P0340 raise, and the
//      TENANT_LIMIT fallback for owners without a subscription.

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
}));

vi.mock("@rently/auth", () => ({
	auth: { api: { getSession: mocks.getSession } },
}));

vi.mock("@rently/email", () => ({
	sendInviteEmail: vi.fn(),
	sendCustomEmailToTenant: vi.fn(),
}));

import {
	assertTenantSeatSql,
	isTenantPlanLimitError,
} from "../helpers/tenant-limit";
import {
	createCombinedLease,
	createLease,
	terminateLease,
	updateLease,
} from "../rent/lease";
import { createTenant, removeTenant } from "../rent/tenant";

const db = createDb();

const createdUserIds: string[] = [];
const createdOwnerIds: string[] = [];
const createdInviteIds: string[] = [];
const createdUnitIds: string[] = [];
const createdPropertyIds: string[] = [];
const createdSubscriptionIds: string[] = [];
const createdPlanIds: string[] = [];

async function createOwner(name = "D04 Owner") {
	const id = crypto.randomUUID();
	createdUserIds.push(id);
	createdOwnerIds.push(id);
	await db.insert(user).values({
		id,
		name,
		email: `${id}@test.keyhq.invalid`,
		role: "owner",
	});
	return { id, name, role: "owner" as const };
}

async function createRegisteredTenant(ownerId: string, name = "D04 Tenant") {
	const id = crypto.randomUUID();
	createdUserIds.push(id);
	await db.insert(user).values({
		id,
		name,
		email: `${id}@test.keyhq.invalid`,
		role: "tenant",
	});
	await db.insert(tenantProfiles).values({
		id: crypto.randomUUID(),
		userId: id,
		createdById: ownerId,
	});
	return { id };
}

// Owner-prepared invite WITHOUT a user row: createLease provisions the
// provisional identity itself (invite id = future user id).
async function createPendingInvite(ownerId: string, name = "D04 Pending") {
	const id = crypto.randomUUID();
	createdInviteIds.push(id);
	await db.insert(tenantInvites).values({
		id,
		name,
		email: `${id}@test.keyhq.invalid`,
		token: crypto.randomUUID(),
		onboardingMode: "owner_prepared",
		invitedById: ownerId,
		status: "pending",
	});
	return { id };
}

async function createPropertyWithUnits(ownerId: string, unitCount: number) {
	const propertyId = crypto.randomUUID();
	createdPropertyIds.push(propertyId);
	await db.insert(properties).values({
		id: propertyId,
		ownerId,
		name: "D04 Property",
		address: "D04 Test Road",
		type: "residential",
	});
	const unitIds = Array.from({ length: unitCount }, () => crypto.randomUUID());
	createdUnitIds.push(...unitIds);
	await db.insert(units).values(
		unitIds.map((unitId, index) => ({
			id: unitId,
			propertyId,
			unitNumber: `D04-${propertyId.slice(0, 6)}-${index}`,
			type: "1BHK",
			baseRent: 1000,
			status: "available",
		})),
	);
	return { propertyId, unitIds };
}

// A plan row with an arbitrary tenantLimit plus the owner's one subscription
// (D01: exactly one row per user).
async function setOwnerPlan(ownerId: string, tenantLimit: number) {
	const planId = crypto.randomUUID();
	createdPlanIds.push(planId);
	await db.insert(plans).values({
		id: planId,
		name: "D04 Plan",
		slug: `d04-${planId}`,
		tenantLimit,
		priceMonthly: 0,
	});
	const subscriptionId = crypto.randomUUID();
	createdSubscriptionIds.push(subscriptionId);
	await db.insert(subscriptions).values({
		id: subscriptionId,
		userId: ownerId,
		planId,
	});
}

// Direct activation fixture (no API): registers a lease and marks its unit
// occupied without accruing charges.
async function activateLeaseDirectly(tenantId: string, unitId: string) {
	const leaseId = crypto.randomUUID();
	await db.insert(leases).values({
		id: leaseId,
		unitId,
		tenantId,
		startDate: new Date("2026-08-01T00:00:00.000Z"),
		rent: 1000,
		status: LEASE_STATUSES.ACTIVE,
	});
	await db
		.update(units)
		.set({ status: "occupied" })
		.where(eq(units.id, unitId));
	return leaseId;
}

function clientFor(
	owner: { id: string; name: string; role: "owner" },
	target: typeof db = db,
) {
	mocks.getSession.mockResolvedValue({
		user: owner,
		session: { id: "d04-session" },
	});
	return createRouterClient(
		{
			createLease,
			createCombinedLease,
			updateLease,
			terminateLease,
			createTenant,
			removeTenant,
		},
		{ context: { db: target, headers: new Headers() } },
	);
}

// This shim selects the same supportsBatch branch used by Neon HTTP while
// retaining the disposable local Postgres connection (B11 precedent). Real
// Neon batches map query-builder rows through the column mappers (camelCase
// keys, Date objects); node's tx.execute returns raw snake_case rows with
// unparsed timestamp strings, so re-apply that mapping here — the handlers
// under test feed builder rows into drizzle output schemas. (B11's shim
// skipped this because its handlers read raw execute-entry rows directly.)
function neonPathDatabase() {
	const toCamel = (key: string) =>
		key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
	const timestampKeys = new Set([
		"start_date",
		"end_date",
		"created_at",
		"updated_at",
	]);
	const mapRow = (row: Record<string, unknown>) =>
		Object.fromEntries(
			Object.entries(row).map(([key, value]) => [
				toCamel(key),
				timestampKeys.has(key) && typeof value === "string"
					? new Date(value)
					: value,
			]),
		);
	return new Proxy(db, {
		get(target, property, receiver) {
			if (property === "batch") {
				return (queries: Array<{ getSQL: () => unknown }>) =>
					target.transaction(async (tx) => {
						const results = [];
						for (const query of queries) {
							const raw = await tx.execute(query.getSQL() as never);
							const rows = (raw.rows ?? raw) as Array<Record<string, unknown>>;
							results.push(rows.map(mapRow));
						}
						return results;
					});
			}
			return Reflect.get(target, property, receiver);
		},
	});
}

async function distinctActiveTenantCount(ownerId: string) {
	const rows = await db
		.selectDistinct({ tenantId: leases.tenantId })
		.from(leases)
		.innerJoin(units, eq(units.id, leases.unitId))
		.innerJoin(properties, eq(properties.id, units.propertyId))
		.where(and(eq(properties.ownerId, ownerId), eq(leases.status, "active")));
	return rows.length;
}

async function leaseStatusOnUnit(unitId: string) {
	const [row] = await db
		.select({ status: leases.status })
		.from(leases)
		.where(eq(leases.unitId, unitId))
		.orderBy(leases.createdAt)
		.limit(1);
	return row?.status ?? null;
}

afterEach(async () => {
	// RESTRICT-safe order: period ledger → leases → agreements → units →
	// properties → profiles → invites → subscriptions → plans → users.
	// API-created rows are swept owner-scoped (invites by invitedById, the
	// provisional user/profile whose id equals the invite id) — response-side
	// tracking alone leaks whenever a refusal expectation does not hold.
	const leaseIds = createdUnitIds.length
		? await db
				.select({ id: leases.id, agreementId: leases.agreementId })
				.from(leases)
				.where(inArray(leases.unitId, createdUnitIds))
		: [];
	if (leaseIds.length > 0) {
		await db.delete(rentAllocations).where(
			inArray(
				rentAllocations.chargeId,
				db
					.select({ id: rentCharges.id })
					.from(rentCharges)
					.where(
						inArray(
							rentCharges.leaseId,
							leaseIds.map((lease) => lease.id),
						),
					),
			),
		);
		await db.delete(rentCharges).where(
			inArray(
				rentCharges.leaseId,
				leaseIds.map((lease) => lease.id),
			),
		);
		await db.delete(leases).where(
			inArray(
				leases.id,
				leaseIds.map((lease) => lease.id),
			),
		);
		const agreementIds = leaseIds
			.map((lease) => lease.agreementId)
			.filter((id): id is string => id !== null);
		if (agreementIds.length > 0) {
			await db
				.delete(leaseAgreements)
				.where(inArray(leaseAgreements.id, agreementIds));
		}
	}
	if (createdUnitIds.length > 0) {
		await db.delete(units).where(inArray(units.id, createdUnitIds));
	}
	if (createdPropertyIds.length > 0) {
		await db
			.delete(properties)
			.where(inArray(properties.id, createdPropertyIds));
	}
	const apiInviteIds = createdOwnerIds.length
		? (
				await db
					.select({ id: tenantInvites.id })
					.from(tenantInvites)
					.where(inArray(tenantInvites.invitedById, createdOwnerIds))
			).map((row) => row.id)
		: [];
	const allInviteIds = [...new Set([...createdInviteIds, ...apiInviteIds])];
	const allTenantUserIds = [...new Set([...createdUserIds, ...allInviteIds])];
	if (allTenantUserIds.length > 0) {
		await db
			.delete(tenantProfiles)
			.where(
				or(
					inArray(tenantProfiles.userId, allTenantUserIds),
					inArray(tenantProfiles.invitedId, allInviteIds),
				),
			);
	}
	if (allInviteIds.length > 0) {
		await db
			.delete(tenantInvites)
			.where(inArray(tenantInvites.id, allInviteIds));
	}
	if (createdSubscriptionIds.length > 0) {
		await db
			.delete(subscriptions)
			.where(inArray(subscriptions.id, createdSubscriptionIds));
	}
	if (createdPlanIds.length > 0) {
		await db.delete(plans).where(inArray(plans.id, createdPlanIds));
	}
	if (allTenantUserIds.length > 0) {
		await db.delete(user).where(inArray(user.id, allTenantUserIds));
	}
	createdUserIds.length = 0;
	createdOwnerIds.length = 0;
	createdInviteIds.length = 0;
	createdUnitIds.length = 0;
	createdPropertyIds.length = 0;
	createdSubscriptionIds.length = 0;
	createdPlanIds.length = 0;
	mocks.getSession.mockReset();
});

describe("tenant plan limit at activation", () => {
	// The races wait on real advisory-lock contention; under a loaded machine
	// that can exceed vitest's 5s default, so these get an explicit budget.
	it("lets exactly one of two concurrent activations pass on a full plan (node path)", {
		timeout: 30_000,
	}, async () => {
		// Pre-fix both activations succeeded: nothing checked seats at
		// activation, so the plan limit was unenforceable under concurrency.
		const owner = await createOwner();
		await setOwnerPlan(owner.id, 2);
		const { unitIds } = await createPropertyWithUnits(owner.id, 3);
		const tenantA = await createRegisteredTenant(owner.id, "D04 Tenant A");
		await activateLeaseDirectly(tenantA.id, unitIds[0] as string);
		const inviteB = await createPendingInvite(owner.id, "D04 Pending B");
		const inviteC = await createPendingInvite(owner.id, "D04 Pending C");

		const client = clientFor(owner);
		const results = await Promise.allSettled([
			client.createLease({
				unitId: unitIds[1] as string,
				tenantId: inviteB.id,
				startDate: new Date("2026-09-01T00:00:00.000Z"),
				rent: 1000,
			}),
			client.createLease({
				unitId: unitIds[2] as string,
				tenantId: inviteC.id,
				startDate: new Date("2026-09-01T00:00:00.000Z"),
				rent: 1000,
			}),
		]);

		const fulfilled = results.filter((r) => r.status === "fulfilled");
		const rejected = results.filter(
			(r): r is PromiseRejectedResult => r.status === "rejected",
		);
		expect(fulfilled).toHaveLength(1);
		expect(rejected).toHaveLength(1);
		expect(rejected[0]?.reason).toMatchObject({ code: "FORBIDDEN" });
		expect(String(rejected[0]?.reason?.message)).toMatch(/plan limit/);

		// The loser must leave zero partial state: no provisional user, the
		// invite still pending, the unit still available.
		expect(await distinctActiveTenantCount(owner.id)).toBe(2);
		const provisionalUsers = await db
			.select({ id: user.id })
			.from(user)
			.where(inArray(user.id, [inviteB.id, inviteC.id]));
		expect(provisionalUsers).toHaveLength(1);
		const loserId =
			provisionalUsers[0]?.id === inviteB.id ? inviteC.id : inviteB.id;
		const [loserInvite] = await db
			.select({ status: tenantInvites.status })
			.from(tenantInvites)
			.where(eq(tenantInvites.id, loserId));
		expect(loserInvite?.status).toBe("pending");
		const loserUnitId = loserId === inviteB.id ? unitIds[1] : unitIds[2];
		expect(await leaseStatusOnUnit(loserUnitId as string)).toBeNull();
		const [loserUnit] = await db
			.select({ status: units.status })
			.from(units)
			.where(eq(units.id, loserUnitId as string));
		expect(loserUnit?.status).toBe("available");
	});

	it("lets exactly one of two concurrent activations pass on a full plan (Neon batch path)", {
		timeout: 30_000,
	}, async () => {
		// The batch path wires the seat assert as batch[0]; a raise there must
		// abort every statement of the production Neon batch, not just the
		// lease insert.
		const owner = await createOwner();
		await setOwnerPlan(owner.id, 2);
		const { unitIds } = await createPropertyWithUnits(owner.id, 3);
		const tenantA = await createRegisteredTenant(owner.id, "D04 Tenant A");
		await activateLeaseDirectly(tenantA.id, unitIds[0] as string);
		const inviteB = await createPendingInvite(owner.id, "D04 Pending B");
		const inviteC = await createPendingInvite(owner.id, "D04 Pending C");

		const client = clientFor(owner, neonPathDatabase());
		const results = await Promise.allSettled([
			client.createLease({
				unitId: unitIds[1] as string,
				tenantId: inviteB.id,
				startDate: new Date("2026-09-01T00:00:00.000Z"),
				rent: 1000,
			}),
			client.createLease({
				unitId: unitIds[2] as string,
				tenantId: inviteC.id,
				startDate: new Date("2026-09-01T00:00:00.000Z"),
				rent: 1000,
			}),
		]);

		const rejected = results.filter(
			(r): r is PromiseRejectedResult => r.status === "rejected",
		);
		expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
		expect(rejected[0]?.reason).toMatchObject({ code: "FORBIDDEN" });
		expect(await distinctActiveTenantCount(owner.id)).toBe(2);
	});

	it("does not consume a second seat for more leases of an already-active tenant", async () => {
		// "A distinct tenant" is per owner across all properties — the shipped
		// count(distinct tenant_id) over active leases. A per-lease or
		// per-unit reading would refuse a second unit for a tenant the owner
		// already seats once.
		const owner = await createOwner();
		await setOwnerPlan(owner.id, 1);
		const { unitIds } = await createPropertyWithUnits(owner.id, 5);
		const tenant = await createRegisteredTenant(owner.id);

		const client = clientFor(owner);
		const first = await client.createLease({
			unitId: unitIds[0] as string,
			tenantId: tenant.id,
			startDate: new Date("2026-09-01T00:00:00.000Z"),
			rent: 1000,
		});
		await client.createLease({
			unitId: unitIds[1] as string,
			tenantId: tenant.id,
			startDate: new Date("2026-09-01T00:00:00.000Z"),
			rent: 1000,
		});
		await client.createCombinedLease({
			tenantId: tenant.id,
			startDate: new Date("2026-09-01T00:00:00.000Z"),
			units: [
				{ unitId: unitIds[2] as string, rent: 1000 },
				{ unitId: unitIds[3] as string, rent: 1000 },
			],
		});

		expect(await distinctActiveTenantCount(owner.id)).toBe(1);
		const activeLeases = await db
			.select({ id: leases.id })
			.from(leases)
			.where(and(eq(leases.tenantId, tenant.id), eq(leases.status, "active")));
		expect(activeLeases).toHaveLength(4);
		expect(first.lease.status).toBe("active");

		// Control: a DIFFERENT tenant cannot take a seat the plan does not have.
		const other = await createRegisteredTenant(owner.id, "D04 Tenant B");
		await expect(
			client.createLease({
				unitId: unitIds[4] as string,
				tenantId: other.id,
				startDate: new Date("2026-09-01T00:00:00.000Z"),
				rent: 1000,
			}),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("treats terminated-lease reactivation as an activation", async () => {
		// Reactivation is the third activation path; before this slice it
		// never checked the plan, so a terminated tenant could be re-seated on
		// a full plan.
		const owner = await createOwner();
		await setOwnerPlan(owner.id, 1);
		const { unitIds } = await createPropertyWithUnits(owner.id, 2);
		const tenantA = await createRegisteredTenant(owner.id, "D04 Tenant A");
		const leaseA = await activateLeaseDirectly(
			tenantA.id,
			unitIds[0] as string,
		);
		const tenantB = await createRegisteredTenant(owner.id, "D04 Tenant B");
		const leaseB = await db
			.insert(leases)
			.values({
				id: crypto.randomUUID(),
				unitId: unitIds[1] as string,
				tenantId: tenantB.id,
				startDate: new Date("2026-08-01T00:00:00.000Z"),
				rent: 1000,
				status: "terminated",
			})
			.returning();

		const client = clientFor(owner);
		await expect(
			client.updateLease({
				id: leaseB[0]?.id as string,
				data: { status: "active" },
			}),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		const [stillTerminated] = await db
			.select({ status: leases.status })
			.from(leases)
			.where(eq(leases.id, leaseB[0]?.id as string));
		expect(stillTerminated?.status).toBe("terminated");

		// Free tenant A's seat, then the reactivation must pass.
		await client.terminateLease({ id: leaseA });
		await client.updateLease({
			id: leaseB[0]?.id as string,
			data: { status: "active" },
		});
		expect(await distinctActiveTenantCount(owner.id)).toBe(1);
		const [unitB] = await db
			.select({ status: units.status })
			.from(units)
			.where(eq(units.id, unitIds[1] as string));
		expect(unitB?.status).toBe("occupied");
	});

	it("frees the seat when removal ends the tenant's last active lease", async () => {
		// The seat count is derived from live rows; this pins that no seat
		// ledger exists that could keep a removed tenant's seat occupied.
		const owner = await createOwner();
		await setOwnerPlan(owner.id, 1);
		const { unitIds } = await createPropertyWithUnits(owner.id, 2);
		const tenantA = await createRegisteredTenant(owner.id, "D04 Tenant A");

		const client = clientFor(owner);
		await client.createLease({
			unitId: unitIds[0] as string,
			tenantId: tenantA.id,
			startDate: new Date("2026-09-01T00:00:00.000Z"),
			rent: 1000,
		});

		const removal = await client.removeTenant({ tenantId: tenantA.id });
		expect(removal.leasesTerminated).toBe(1);

		const tenantB = await createRegisteredTenant(owner.id, "D04 Tenant B");
		await client.createLease({
			unitId: unitIds[1] as string,
			tenantId: tenantB.id,
			startDate: new Date("2026-09-01T00:00:00.000Z"),
			rent: 1000,
		});
		expect(await distinctActiveTenantCount(owner.id)).toBe(1);
	});

	it("quotas concurrent pending invites separately from active seats", async () => {
		// D04 defines the pending-invite quota: at most tenantLimit
		// concurrently-pending, unexpired invites — expiry must release quota
		// even before the lazy status flip runs.
		const owner = await createOwner();
		await setOwnerPlan(owner.id, 2);

		const client = clientFor(owner);
		const first = await client.createTenant({
			name: "D04 Pending 1",
			email: `d04-p1-${crypto.randomUUID()}@test.keyhq.invalid`,
		});
		const second = await client.createTenant({
			name: "D04 Pending 2",
			email: `d04-p2-${crypto.randomUUID()}@test.keyhq.invalid`,
		});
		// API-created invites provision a provisional user with id = invite id
		// (owner_prepared) — track both so teardown removes them.
		createdInviteIds.push(first.invite.id, second.invite.id);
		createdUserIds.push(first.invite.id, second.invite.id);

		await expect(
			client.createTenant({
				name: "D04 Pending 3",
				email: `d04-p3-${crypto.randomUUID()}@test.keyhq.invalid`,
			}),
		).rejects.toMatchObject({ code: "FORBIDDEN" });

		// Expire the second invite in place (status stays pending): it must
		// stop counting against the quota.
		await db
			.update(tenantInvites)
			.set({ expiresAt: new Date(Date.now() - 1000) })
			.where(eq(tenantInvites.id, second.invite.id));
		const fourth = await client.createTenant({
			name: "D04 Pending 4",
			email: `d04-p4-${crypto.randomUUID()}@test.keyhq.invalid`,
		});
		createdInviteIds.push(fourth.invite.id);
		createdUserIds.push(fourth.invite.id);
		expect(fourth.invite.status).toBe("pending");
	});

	it("no longer refuses invites when the plan seats are full", async () => {
		// Behavior change pinned on purpose: the invite-time check used the
		// ACTIVE-tenant count, so a full plan could not even invite. Seats are
		// now enforced at activation; invites follow their own quota.
		const owner = await createOwner();
		await setOwnerPlan(owner.id, 1);
		const { unitIds } = await createPropertyWithUnits(owner.id, 1);
		const tenantA = await createRegisteredTenant(owner.id, "D04 Tenant A");
		await activateLeaseDirectly(tenantA.id, unitIds[0] as string);

		const client = clientFor(owner);
		const invite = await client.createTenant({
			name: "D04 Pending Full Plan",
			email: `d04-full-${crypto.randomUUID()}@test.keyhq.invalid`,
		});
		createdInviteIds.push(invite.invite.id);
		createdUserIds.push(invite.invite.id);
		expect(invite.invite.status).toBe("pending");
	});

	it("seat guard SQL excludes the activating tenant and raises P0340 at the limit", async () => {
		// The SQL function is the enforcement definition; pin its exclusion
		// semantics and error contract directly, including the TENANT_LIMIT
		// fallback when the owner has no subscription row.
		const owner = await createOwner();
		// No subscription: the fallback limit of 10 applies.
		const { unitIds } = await createPropertyWithUnits(owner.id, 10);
		const tenants = [];
		for (let index = 0; index < 10; index += 1) {
			tenants.push(
				await createRegisteredTenant(owner.id, `D04 Fallback ${index}`),
			);
		}
		for (let index = 0; index < 9; index += 1) {
			await activateLeaseDirectly(
				tenants[index]?.id as string,
				unitIds[index] as string,
			);
		}
		const outsider = crypto.randomUUID();

		// 9 other active tenants < fallback limit 10: the activation passes.
		await db.execute(assertTenantSeatSql(owner.id, outsider));

		// 10 other active tenants: the raise aborts with the mapped code.
		await activateLeaseDirectly(tenants[9]?.id as string, unitIds[9] as string);
		const failure = await db
			.execute(assertTenantSeatSql(owner.id, outsider))
			.then(
				() => null,
				(error) => error,
			);
		expect(isTenantPlanLimitError(failure)).toBe(true);

		// An already-active tenant excludes themselves: never refused.
		await db.execute(assertTenantSeatSql(owner.id, tenants[0]?.id as string));
	});
});
