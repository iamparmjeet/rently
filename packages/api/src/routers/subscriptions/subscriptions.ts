import { ORPCError } from "@orpc/server";
import { ownerProcedure, publicProcedure } from "@rently/api/procedures";
import {
	BILLING_INTERVAL,
	PLAN_STATUS,
} from "@rently/db/constants/payment-constants";
import {
	betaAccessCodes,
	invoices,
	plans,
	subscriptions,
} from "@rently/db/schema/subscription";
import { generatedId } from "@rently/db/utils/id";
import {
	MySubscriptionResponseSchema,
	PlanSelectSchema,
	RedeemBetaCodeSchema,
} from "@rently/validators";
import {
	and,
	desc,
	eq,
	getTableColumns,
	gt,
	isNull,
	or,
	sql,
} from "drizzle-orm";
import z from "zod";

// ── List all plans (public — used on pricing page + upgrade modals)
export const listPlans = publicProcedure
	.route({ method: "GET", path: "/subscription/plans" })
	.output(z.object({ plans: z.array(PlanSelectSchema) }))
	.handler(async ({ context }) => {
		const allPlans = await context.db
			.select()
			.from(plans)
			.orderBy(plans.priceMonthly);

		return { plans: allPlans };
	});

// ── Get current user's subscription + plan + recent invoices
export const getMySubscription = ownerProcedure
	.route({ method: "GET", path: "/subscription/me" })
	.output(MySubscriptionResponseSchema)
	.handler(async ({ context }) => {
		const { db, user } = context;

		let [subRow] = await db
			.select({
				...getTableColumns(subscriptions),
				plan: { ...getTableColumns(plans) },
			})
			.from(subscriptions)
			.innerJoin(plans, eq(subscriptions.planId, plans.id))
			.where(eq(subscriptions.userId, user.id))
			.orderBy(desc(subscriptions.createdAt))
			.limit(1);

		if (!subRow) {
			const [freePlan] = await db
				.select({ id: plans.id })
				.from(plans)
				.where(eq(plans.slug, "free"))
				.limit(1);

			if (freePlan) {
				await db.insert(subscriptions).values({
					id: generatedId(),
					userId: user.id,
					planId: freePlan.id,
					status: PLAN_STATUS.ACTIVE,
					billingInterval: BILLING_INTERVAL.MONTHLY,
					currentPeriodStart: new Date(),
					currentPeriodEnd: null,
					trialEndsAt: null,
					expired: false,
				});
				// Re-fetch so the return shape is consistent
				[subRow] = await db
					.select({
						...getTableColumns(subscriptions),
						plan: { ...getTableColumns(plans) },
					})
					.from(subscriptions)
					.innerJoin(plans, eq(subscriptions.planId, plans.id))
					.where(eq(subscriptions.userId, user.id))
					.limit(1);
			}
		}

		const userInvoices = await db
			.select()
			.from(invoices)
			.where(eq(invoices.userId, user.id))
			.orderBy(desc(invoices.createdAt))
			.limit(12);

		return {
			subscription: subRow ?? null,
			invoices: userInvoices,
		};
	});

// ── Redeem a beta access code
export const redeemBetaCode = ownerProcedure
	.route({ method: "POST", path: "/subscription/redeem" })
	.input(RedeemBetaCodeSchema)
	.output(z.object({ success: z.boolean(), planName: z.string() }))
	.handler(async ({ context, input }) => {
		const { db, user } = context;
		const now = new Date();

		// WHY transaction: we read the code, check it, update the subscription, and
		let planName = "";

		await db.transaction(async (tx) => {
			// Step 1: Find a valid code with remaining uses
			const [code] = await tx
				.select()
				.from(betaAccessCodes)
				.where(
					and(
						eq(betaAccessCodes.code, input.code),
						// Uses remaining
						sql`${betaAccessCodes.totalUses} < ${betaAccessCodes.maxUses}`,
						// Not expired (null = never expires)
						or(
							isNull(betaAccessCodes.expiresAt),
							gt(betaAccessCodes.expiresAt, now),
						),
					),
				)
				.limit(1);

			if (!code) {
				throw new ORPCError("NOT_FOUND", {
					message:
						"Invalid or expired beta code. Double-check the code and try again.",
				});
			}

			// Step 2: Resolve the target plan
			const [targetPlan] = await tx
				.select({ id: plans.id, name: plans.name })
				.from(plans)
				.where(eq(plans.slug, code.grantsPlanSlug))
				.limit(1);

			if (!targetPlan) {
				// Config error — admin issued a code pointing at a non-existent plan slug
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Beta code configuration error. Please contact support.",
				});
			}

			planName = targetPlan.name;

			// Step 3: Compute the access window
			const periodEnd = new Date(now);
			periodEnd.setDate(periodEnd.getDate() + code.periodDays);

			// Step 4: Upgrade the subscription
			const updated = await tx
				.update(subscriptions)
				.set({
					planId: targetPlan.id,
					status: PLAN_STATUS.ACTIVE,
					currentPeriodStart: now,
					currentPeriodEnd: periodEnd,
					updatedAt: new Date(),
				})
				.where(eq(subscriptions.userId, user.id));

			// Guard: if no subscription row existed (hook failure at registration),

			if (!updated) {
				await tx.insert(subscriptions).values({
					id: generatedId(),
					userId: user.id,
					planId: targetPlan.id,
					status: PLAN_STATUS.ACTIVE,
					billingInterval: BILLING_INTERVAL.MONTHLY,
					currentPeriodStart: now,
					currentPeriodEnd: periodEnd,
					expired: false,
				});
			}

			// Step 5: Mark the code as used
			// WHY sql atomic increment: avoids read-modify-write race condition.
			// The DB does the increment, not the application layer.
			await tx
				.update(betaAccessCodes)
				.set({
					totalUses: sql`${betaAccessCodes.totalUses} + 1`,
					// For single-use codes, record the user permanently
					usedByUserId: code.maxUses === 1 ? user.id : code.usedByUserId,
					usedAt: code.maxUses === 1 ? now : code.usedAt,
				})
				.where(eq(betaAccessCodes.id, code.id));
		});

		return { success: true, planName };
	});
