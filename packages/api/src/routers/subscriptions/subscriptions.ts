import { ORPCError } from "@orpc/server";
import { ownerProcedure, publicProcedure } from "@rently/api/procedures";
import {
	betaAccessCodes,
	betaCodeRedemptions,
	invoices,
	plans,
	subscriptions,
} from "@rently/db/schema/subscription";
import { ensureFreeSubscriptionSql } from "@rently/db/subscription-provisioning";
import {
	MySubscriptionResponseSchema,
	PlanSelectSchema,
	RedeemBetaCodeSchema,
} from "@rently/validators";
import { desc, eq, getTableColumns, sql } from "drizzle-orm";
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
			// D01: idempotent provisioning — the upsert races on the
			// subscriptions_user_id_unique index, so concurrent first GETs
			// converge on one row instead of duplicating.
			await db.execute(ensureFreeSubscriptionSql(user.id));
			[subRow] = await db
				.select({
					...getTableColumns(subscriptions),
					plan: { ...getTableColumns(plans) },
				})
				.from(subscriptions)
				.innerJoin(plans, eq(subscriptions.planId, plans.id))
				.where(eq(subscriptions.userId, user.id))
				.orderBy(desc(subscriptions.createdAt), desc(subscriptions.id))
				.limit(1);
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

		// D02: one atomic statement for the whole redemption — claim the use,
		// record the redemption, and grant the entitlement commit together or
		// not at all, on both drivers.
		//
		// - `claimed` conditional-updates the counter (total_uses < max_uses,
		//   code unexpired, this user has not already redeemed, and the granted
		//   plan actually resolves — an unresolvable plan means nothing is
		//   written, so usage and entitlement can never diverge);
		// - `redemption` records the grant (the (code_id, user_id) unique index
		//   makes a same-user retry a no-op instead of a second burned use);
		// - `ensured` + `updated` grant the entitlement to the user's exactly-
		//   one subscription row (D01 unique index).
		const result = await db.execute<{
			status: string;
			plan_name: string | null;
		}>(sql`
			WITH code AS (
				SELECT c."id", c."grants_plan_slug", c."period_days", c."max_uses"
				FROM ${betaAccessCodes} c
				WHERE c."code" = ${input.code}
					AND (c."expires_at" IS NULL OR c."expires_at" > now())
				LIMIT 1
			), claimed AS (
				UPDATE ${betaAccessCodes} c
				SET "total_uses" = c."total_uses" + 1,
					"used_by_user_id" = CASE WHEN c."max_uses" = 1 THEN ${user.id} ELSE c."used_by_user_id" END,
					"used_at" = CASE WHEN c."max_uses" = 1 THEN now() ELSE c."used_at" END
				FROM "code" k
				JOIN ${plans} p ON p."slug" = k."grants_plan_slug"
				WHERE c."id" = k."id"
					AND c."total_uses" < k."max_uses"
					AND NOT EXISTS (
						SELECT 1 FROM ${betaCodeRedemptions} r
						WHERE r."code_id" = c."id" AND r."user_id" = ${user.id}
					)
				RETURNING c."id", p."id" AS "plan_id", p."name" AS "plan_name", k."period_days"
			), redemption AS (
				INSERT INTO ${betaCodeRedemptions} ("id", "code_id", "user_id")
				SELECT gen_random_uuid(), cl."id", ${user.id}
				FROM "claimed" cl
				ON CONFLICT ("code_id", "user_id") DO NOTHING
			), ensured AS (
				INSERT INTO ${subscriptions} ("id", "user_id", "plan_id")
				SELECT gen_random_uuid(), ${user.id}, cl."plan_id"
				FROM "claimed" cl
				ON CONFLICT ("user_id") DO NOTHING
			), updated AS (
				UPDATE ${subscriptions} s
				SET "plan_id" = cl."plan_id",
					"status" = 'active',
					"current_period_start" = now(),
					"current_period_end" = now() + (cl."period_days" || ' days')::interval,
					"updated_at" = now()
				FROM "claimed" cl
				WHERE s."user_id" = ${user.id}
			)
			SELECT
				CASE
					WHEN EXISTS (SELECT 1 FROM "claimed") THEN 'redeemed'
					WHEN EXISTS (
						SELECT 1 FROM ${betaCodeRedemptions} r
						JOIN "code" k ON k."id" = r."code_id"
						WHERE r."user_id" = ${user.id}
					) THEN 'already_redeemed'
					WHEN NOT EXISTS (SELECT 1 FROM "code") THEN 'not_found'
					ELSE 'unavailable'
				END AS "status",
				COALESCE((
					SELECT "plan_name" FROM "claimed" LIMIT 1
				), (
					SELECT p."name"
					FROM ${betaCodeRedemptions} r
					JOIN "code" k ON k."id" = r."code_id"
					JOIN ${plans} p ON p."slug" = k."grants_plan_slug"
					WHERE r."user_id" = ${user.id}
					LIMIT 1
				)) AS "plan_name"
		`);

		const outcome = result.rows[0];
		if (
			!outcome ||
			outcome.status === "not_found" ||
			outcome.status === "unavailable"
		) {
			throw new ORPCError("NOT_FOUND", {
				message:
					"Invalid or expired beta code. Double-check the code and try again.",
			});
		}

		return { success: true, planName: outcome.plan_name ?? "" };
	});
