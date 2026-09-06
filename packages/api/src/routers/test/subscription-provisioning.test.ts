// D01 provisioning tests. Per the AGENTS.md test rule, each case pins a
// regression the one-current-subscription invariant must prevent:
// - concurrent first GETs (or a GET racing the signup hook) previously
//   inserted duplicate subscription rows via racy read-then-write paths —
//   the upsert + user_id unique index must converge them on one row;
// - a direct duplicate insert must be refused (23505) so nothing can bypass
//   the provisioning command;
// - an existing subscription must be returned untouched (no second row, no
//   plan/period mutation) — provisioning is creation-only.
import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import { user } from "@rently/db/schema/auth";
import { plans, subscriptions } from "@rently/db/schema/subscription";
import { ensureFreeSubscriptionSql } from "@rently/db/subscription-provisioning";
import { and, eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getMySubscription } from "../subscriptions/subscriptions";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
}));

vi.mock("@rently/auth", () => ({
	auth: { api: { getSession: mocks.getSession } },
}));

const db = createDb();
const createdUserIds: string[] = [];
const createdPlanIds: string[] = [];
const createdSubscriptionIds: string[] = [];

async function seedPerson(name: string, role: "owner" | "tenant") {
	const id = crypto.randomUUID();
	createdUserIds.push(id);
	await db.insert(user).values({
		id,
		name,
		email: `${id}@test.keyhq.invalid`,
		role,
	});
	return id;
}

// The free plan is normally provided by db:seed; rently_test may not have
// it, so the fixture ensures one exists (idempotent on the unique slug).
async function ensureFreePlan(): Promise<string> {
	const [existing] = await db
		.select({ id: plans.id })
		.from(plans)
		.where(eq(plans.slug, "free"))
		.limit(1);
	if (existing) return existing.id;
	const id = crypto.randomUUID();
	createdPlanIds.push(id);
	await db.insert(plans).values({
		id,
		slug: "free",
		name: "Free",
		priceMonthly: 0,
		priceYearly: 0,
		priceTwoYear: 0,
	});
	return id;
}

function client(ownerId: string) {
	mocks.getSession.mockResolvedValue({
		user: { id: ownerId, role: "owner" },
		session: { id: "d01-session" },
	});
	return createRouterClient(
		{ getMySubscription },
		{ context: { db, headers: new Headers() } as never },
	);
}

afterEach(async () => {
	// Provisioned rows are not id-tracked — delete by user before the users
	// (the RESTRICT FK makes an incomplete teardown loud).
	if (createdUserIds.length > 0) {
		await db
			.delete(subscriptions)
			.where(inArray(subscriptions.userId, createdUserIds));
	}
	if (createdPlanIds.length > 0) {
		await db.delete(plans).where(inArray(plans.id, createdPlanIds));
	}
	if (createdUserIds.length > 0) {
		await db.delete(user).where(inArray(user.id, createdUserIds));
	}
	createdUserIds.length = 0;
	createdPlanIds.length = 0;
	createdSubscriptionIds.length = 0;
	mocks.getSession.mockReset();
});

describe("subscription provisioning (D01)", () => {
	it("concurrent first GETs converge on exactly one subscription row", async () => {
		await ensureFreePlan();
		const ownerId = await seedPerson("D01 Owner", "owner");
		const api = client(ownerId);

		const results = await Promise.all(
			Array.from({ length: 5 }, () => api.getMySubscription()),
		);

		const rows = await db
			.select({ id: subscriptions.id })
			.from(subscriptions)
			.where(eq(subscriptions.userId, ownerId));
		expect(rows).toHaveLength(1);
		const rowId = rows[0]?.id;
		for (const result of results) {
			expect(result.subscription?.id).toBe(rowId);
		}
	});

	it("the provisioning upsert is idempotent under a direct race", async () => {
		const ownerId = await seedPerson("D01 Upsert Owner", "owner");
		await ensureFreePlan();

		await Promise.all([
			db.execute(ensureFreeSubscriptionSql(ownerId)),
			db.execute(ensureFreeSubscriptionSql(ownerId)),
			db.execute(ensureFreeSubscriptionSql(ownerId)),
		]);

		const rows = await db
			.select({ id: subscriptions.id, status: subscriptions.status })
			.from(subscriptions)
			.where(eq(subscriptions.userId, ownerId));
		expect(rows).toHaveLength(1);
		expect(rows[0]?.status).toBe("active");
	});

	it("refuses a raw duplicate insert (the index is the arbiter)", async () => {
		const planId = await ensureFreePlan();
		const ownerId = await seedPerson("D01 Dup Owner", "owner");
		const firstId = crypto.randomUUID();
		createdSubscriptionIds.push(firstId);
		await db.insert(subscriptions).values({
			id: firstId,
			userId: ownerId,
			planId,
			status: "active",
		});

		const code = await db
			.insert(subscriptions)
			.values({
				id: crypto.randomUUID(),
				userId: ownerId,
				planId,
				status: "active",
			})
			.then(
				() => null,
				(error: unknown) => {
					const top = error as { code?: unknown; cause?: unknown } | null;
					if (typeof top?.code === "string") return top.code;
					const cause = top?.cause as { code?: unknown } | null | undefined;
					return typeof cause?.code === "string" ? cause.code : null;
				},
			);
		expect(code).toBe("23505");
	});

	it("an existing subscription is returned untouched, with no second row", async () => {
		const planId = await ensureFreePlan();
		const ownerId = await seedPerson("D01 Existing Owner", "owner");
		const existingId = crypto.randomUUID();
		createdSubscriptionIds.push(existingId);
		await db.insert(subscriptions).values({
			id: existingId,
			userId: ownerId,
			planId,
		});

		const result = await client(ownerId).getMySubscription();
		expect(result.subscription?.id).toBe(existingId);

		const rows = await db
			.select({ id: subscriptions.id })
			.from(subscriptions)
			.where(
				and(
					eq(subscriptions.userId, ownerId),
					eq(subscriptions.status, "active"),
				),
			);
		expect(rows).toHaveLength(1);
	});

	it("a missing free plan leaves the user subscriptionless without crashing", async (ctx) => {
		// Only exercisable on a database without the seeded free plan — the
		// upsert's SELECT is empty and nothing is inserted.
		const [freePlan] = await db
			.select({ id: plans.id })
			.from(plans)
			.where(eq(plans.slug, "free"))
			.limit(1);
		if (freePlan) {
			ctx.skip();
			return;
		}
		const ownerId = await seedPerson("D01 No Plan Owner", "owner");
		const result = await client(ownerId).getMySubscription();
		expect(result.subscription).toBeNull();
	});
});
