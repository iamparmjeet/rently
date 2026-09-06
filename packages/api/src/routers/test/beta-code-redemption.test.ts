// D02 beta-code redemption tests. Per the AGENTS.md test rule, each case
// pins a regression the atomic redemption must prevent:
// - two users racing for the final use previously both passed the racy
//   read-then-write check and exceeded the code's limit — the conditional
//   claim must let exactly one through;
// - the same user retrying previously burned another use on every attempt —
//   the (code_id, user_id) unique index must make a retry a no-op that still
//   grants the entitlement (and must win over exhaustion);
// - an exhausted code must refuse without any ledger movement;
// - usage and entitlement must commit together: an unresolvable granted plan
//   means nothing is written (no burned use, no redemption row), and the
//   code stays redeemable by a valid code afterwards;
// - the single statement must behave identically on the Neon HTTP driver.
import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import { user } from "@rently/db/schema/auth";
import {
	betaAccessCodes,
	betaCodeRedemptions,
	plans,
	subscriptions,
} from "@rently/db/schema/subscription";
import { eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { redeemBetaCode } from "../subscriptions/subscriptions";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
}));

vi.mock("@rently/auth", () => ({
	auth: { api: { getSession: mocks.getSession } },
}));

const db = createDb();
const createdUserIds: string[] = [];
const createdPlanIds: string[] = [];
const createdCodeIds: string[] = [];
const createdSubscriptionUserIds: string[] = [];

async function seedOwner(name: string) {
	const id = crypto.randomUUID();
	createdUserIds.push(id);
	createdSubscriptionUserIds.push(id);
	await db.insert(user).values({
		id,
		name,
		email: `${id}@test.keyhq.invalid`,
		role: "owner",
	});
	return id;
}

async function seedPlan(slug: string) {
	const id = crypto.randomUUID();
	createdPlanIds.push(id);
	await db.insert(plans).values({
		id,
		slug,
		name: `Plan ${slug}`,
		priceMonthly: 0,
		priceYearly: 0,
		priceTwoYear: 0,
	});
	return id;
}

async function seedCode(options: {
	grantsPlanSlug: string;
	maxUses?: number;
	totalUses?: number;
}) {
	const id = crypto.randomUUID();
	createdCodeIds.push(id);
	await db.insert(betaAccessCodes).values({
		id,
		code: `D02-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
		grantsPlanSlug: options.grantsPlanSlug,
		maxUses: options.maxUses ?? 1,
		totalUses: options.totalUses ?? 0,
	});
	return id;
}

// One shared router client; the caller is selected per call via asSession —
// the getSession mock is module-global, so per-owner clients would silently
// point every call at the last owner (the C05 lesson).
const api = createRouterClient(
	{ redeemBetaCode },
	{ context: { db, headers: new Headers() } as never },
);

function asSession(ownerId: string) {
	mocks.getSession.mockImplementation(async () => ({
		user: { id: ownerId, role: "owner" },
		session: { id: "d02-session" },
	}));
}

// For a true two-user race the mock must answer each concurrent call with a
// different user.
function asSessionsInOrder(ownerIds: string[]) {
	for (const ownerId of ownerIds) {
		mocks.getSession.mockImplementationOnce(async () => ({
			user: { id: ownerId, role: "owner" },
			session: { id: "d02-session" },
		}));
	}
}

function codeOf(codeId: string) {
	return db
		.select({ code: betaAccessCodes.code })
		.from(betaAccessCodes)
		.where(eq(betaAccessCodes.id, codeId))
		.limit(1);
}

async function redemptionCount(codeId: string) {
	const rows = await db
		.select({ id: betaCodeRedemptions.id })
		.from(betaCodeRedemptions)
		.where(eq(betaCodeRedemptions.codeId, codeId));
	return rows.length;
}

afterEach(async () => {
	if (createdSubscriptionUserIds.length > 0) {
		await db
			.delete(subscriptions)
			.where(inArray(subscriptions.userId, createdSubscriptionUserIds));
	}
	if (createdCodeIds.length > 0) {
		await db
			.delete(betaCodeRedemptions)
			.where(inArray(betaCodeRedemptions.codeId, createdCodeIds));
		await db
			.delete(betaAccessCodes)
			.where(inArray(betaAccessCodes.id, createdCodeIds));
	}
	if (createdPlanIds.length > 0) {
		await db.delete(plans).where(inArray(plans.id, createdPlanIds));
	}
	if (createdUserIds.length > 0) {
		await db.delete(user).where(inArray(user.id, createdUserIds));
	}
	createdUserIds.length = 0;
	createdPlanIds.length = 0;
	createdCodeIds.length = 0;
	createdSubscriptionUserIds.length = 0;
	mocks.getSession.mockReset();
});

describe("beta code redemption (D02)", () => {
	it("two users racing for the final use: exactly one wins", async () => {
		const planId = await seedPlan("pro");
		const codeId = await seedCode({ grantsPlanSlug: "pro", maxUses: 1 });
		const userA = await seedOwner("D02 Racer A");
		const userB = await seedOwner("D02 Racer B");
		const [code] = await codeOf(codeId);

		asSessionsInOrder([userA, userB]);
		const results = await Promise.allSettled([
			api.redeemBetaCode({ code: code!.code }),
			api.redeemBetaCode({ code: code!.code }),
		]);

		const fulfilled = results.filter((r) => r.status === "fulfilled");
		expect(fulfilled).toHaveLength(1);

		const [counter] = await db
			.select({ totalUses: betaAccessCodes.totalUses })
			.from(betaAccessCodes)
			.where(eq(betaAccessCodes.id, codeId));
		expect(counter?.totalUses).toBe(1);
		await expect(redemptionCount(codeId)).resolves.toBe(1);

		// The winner holds the granted entitlement on exactly one row.
		const winnerId = results[0]?.status === "fulfilled" ? userA : userB;
		const subs = await db
			.select({ planId: subscriptions.planId })
			.from(subscriptions)
			.where(eq(subscriptions.userId, winnerId));
		expect(subs).toHaveLength(1);
		expect(subs[0]?.planId).toBe(planId);
	});

	it("a same-user retry succeeds without burning another use, even past exhaustion", async () => {
		await seedPlan("pro");
		const codeId = await seedCode({ grantsPlanSlug: "pro", maxUses: 1 });
		const ownerId = await seedOwner("D02 Retry Owner");
		const [code] = await codeOf(codeId);

		asSession(ownerId);
		await api.redeemBetaCode({ code: code!.code });
		const retry = await api.redeemBetaCode({ code: code!.code });

		expect(retry.success).toBe(true);
		const [counter] = await db
			.select({ totalUses: betaAccessCodes.totalUses })
			.from(betaAccessCodes)
			.where(eq(betaAccessCodes.id, codeId));
		expect(counter?.totalUses).toBe(1);
		await expect(redemptionCount(codeId)).resolves.toBe(1);
	});

	it("an exhausted code refuses a new user without ledger movement", async () => {
		await seedPlan("pro");
		const codeId = await seedCode({
			grantsPlanSlug: "pro",
			maxUses: 2,
			totalUses: 2,
		});
		const ownerId = await seedOwner("D02 Late Owner");
		const [code] = await codeOf(codeId);

		asSession(ownerId);
		await expect(
			api.redeemBetaCode({ code: code!.code }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });

		const [counter] = await db
			.select({ totalUses: betaAccessCodes.totalUses })
			.from(betaAccessCodes)
			.where(eq(betaAccessCodes.id, codeId));
		expect(counter?.totalUses).toBe(2);
		await expect(redemptionCount(codeId)).resolves.toBe(0);
		const subs = await db
			.select({ id: subscriptions.id })
			.from(subscriptions)
			.where(eq(subscriptions.userId, ownerId));
		expect(subs).toHaveLength(0);
	});

	it("an unresolvable granted plan writes nothing and the code stays usable", async () => {
		const codeId = await seedCode({
			grantsPlanSlug: "no-such-plan",
			maxUses: 3,
		});
		const ownerId = await seedOwner("D02 Bad Plan Owner");
		const [code] = await codeOf(codeId);

		asSession(ownerId);
		await expect(
			api.redeemBetaCode({ code: code!.code }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });

		const [counter] = await db
			.select({ totalUses: betaAccessCodes.totalUses })
			.from(betaAccessCodes)
			.where(eq(betaAccessCodes.id, codeId));
		expect(counter?.totalUses).toBe(0);
		await expect(redemptionCount(codeId)).resolves.toBe(0);
		const subs = await db
			.select({ id: subscriptions.id })
			.from(subscriptions)
			.where(eq(subscriptions.userId, ownerId));
		expect(subs).toHaveLength(0);

		// Usage and entitlement never diverge: a valid plan redeems fine after.
		await seedPlan("pro");
		await db
			.update(betaAccessCodes)
			.set({ grantsPlanSlug: "pro" })
			.where(eq(betaAccessCodes.id, codeId));
		const retry = await api.redeemBetaCode({ code: code!.code });
		expect(retry.success).toBe(true);
		const [after] = await db
			.select({ totalUses: betaAccessCodes.totalUses })
			.from(betaAccessCodes)
			.where(eq(betaAccessCodes.id, codeId));
		expect(after?.totalUses).toBe(1);
	});

	it("a multi-use code counts distinct users exactly and preserves usedByUserId", async () => {
		// The counter path is not single-use: used_by_user_id must stay null
		// for shared codes (it records the sole user of a 1-use code only).
		await seedPlan("pro");
		const codeId = await seedCode({ grantsPlanSlug: "pro", maxUses: 3 });
		const userA = await seedOwner("D02 Multi A");
		const userB = await seedOwner("D02 Multi B");
		const [code] = await codeOf(codeId);

		asSessionsInOrder([userA, userB]);
		await api.redeemBetaCode({ code: code!.code });
		await api.redeemBetaCode({ code: code!.code });

		const [row] = await db
			.select({
				totalUses: betaAccessCodes.totalUses,
				usedByUserId: betaAccessCodes.usedByUserId,
			})
			.from(betaAccessCodes)
			.where(eq(betaAccessCodes.id, codeId));
		expect(row?.totalUses).toBe(2);
		expect(row?.usedByUserId).toBeNull();
		await expect(redemptionCount(codeId)).resolves.toBe(2);
	});
});
