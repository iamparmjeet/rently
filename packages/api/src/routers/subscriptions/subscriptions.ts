import { ORPCError } from "@orpc/server";
import { ownerProcedure, publicProcedure } from "@rently/api/procedures";
import type { Database } from "@rently/db";
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

type BatchCapableDatabase = Database & {
	batch<T extends readonly unknown[]>(
		queries: T,
	): Promise<{ [K in keyof T]: Awaited<T[K]> }>;
};

function supportsBatch(db: Database): db is BatchCapableDatabase {
	return typeof (db as { batch?: unknown }).batch === "function";
}

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

		let planName = "";

		if (supportsBatch(db)) {
			const [code] = await db
				.select()
				.from(betaAccessCodes)
				.where(
					and(
						eq(betaAccessCodes.code, input.code),
						sql`${betaAccessCodes.totalUses} < ${betaAccessCodes.maxUses}`,
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

			const [targetPlan] = await db
				.select({ id: plans.id, name: plans.name })
				.from(plans)
				.where(eq(plans.slug, code.grantsPlanSlug))
				.limit(1);

			if (!targetPlan) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Beta code configuration error. Please contact support.",
				});
			}

			planName = targetPlan.name;
			const periodEnd = new Date(now);
			periodEnd.setDate(periodEnd.getDate() + code.periodDays);

			const [updated] = await db
				.update(subscriptions)
				.set({
					planId: targetPlan.id,
					status: PLAN_STATUS.ACTIVE,
					currentPeriodStart: now,
					currentPeriodEnd: periodEnd,
					updatedAt: new Date(),
				})
				.where(eq(subscriptions.userId, user.id))
				.returning();

			if (!updated) {
				await db.insert(subscriptions).values({
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

			await db
				.update(betaAccessCodes)
				.set({
					totalUses: sql`${betaAccessCodes.totalUses} + 1`,
					usedByUserId: code.maxUses === 1 ? user.id : code.usedByUserId,
					usedAt: code.maxUses === 1 ? now : code.usedAt,
				})
				.where(eq(betaAccessCodes.id, code.id));
		} else {
			await db.transaction(async (tx) => {
				const [code] = await tx
					.select()
					.from(betaAccessCodes)
					.where(
						and(
							eq(betaAccessCodes.code, input.code),
							sql`${betaAccessCodes.totalUses} < ${betaAccessCodes.maxUses}`,
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

				const [targetPlan] = await tx
					.select({ id: plans.id, name: plans.name })
					.from(plans)
					.where(eq(plans.slug, code.grantsPlanSlug))
					.limit(1);

				if (!targetPlan) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Beta code configuration error. Please contact support.",
					});
				}

				planName = targetPlan.name;
				const periodEnd = new Date(now);
				periodEnd.setDate(periodEnd.getDate() + code.periodDays);

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

				await tx
					.update(betaAccessCodes)
					.set({
						totalUses: sql`${betaAccessCodes.totalUses} + 1`,
						usedByUserId: code.maxUses === 1 ? user.id : code.usedByUserId,
						usedAt: code.maxUses === 1 ? now : code.usedAt,
					})
					.where(eq(betaAccessCodes.id, code.id));
			});
		}

		return { success: true, planName };
	});
