import { ORPCError } from "@orpc/server";
import { type Database, supportsDatabaseBatch } from "@rently/db";
import {
	ADMIN_AUDIT_ACTIONS,
	ADMIN_SUBSCRIPTION_STATUS_FILTERS,
	ADMIN_TARGET_TYPES,
} from "@rently/db/constants/admin-constants";
import {
	BILLING_INTERVAL,
	type BillingInterval,
	CURRENCY_TYPES,
	PAYMENT_STATUS,
	PLAN_STATUS,
} from "@rently/db/constants/payment-constants";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import { adminAuditLogs } from "@rently/db/schema/admin";
import { user } from "@rently/db/schema/auth";
import { invoices, plans, subscriptions } from "@rently/db/schema/subscription";
import { generatedId } from "@rently/db/utils/id";
import type {
	AdminSubscriptionListInput,
	RecordSubscriptionPaymentInput,
} from "@rently/validators";
import { and, count, desc, eq, ilike, or, type SQL, sql } from "drizzle-orm";

function latestSubscriptionQuery(db: Database) {
	return db
		.selectDistinctOn([subscriptions.userId], {
			userId: subscriptions.userId,
			id: subscriptions.id,
			planId: subscriptions.planId,
			status: subscriptions.status,
			billingInterval: subscriptions.billingInterval,
			currentPeriodStart: subscriptions.currentPeriodStart,
			currentPeriodEnd: subscriptions.currentPeriodEnd,
			nextBillingDate: subscriptions.nextBillingDate,
			expired: subscriptions.expired,
			totalPaid: subscriptions.totalPaid,
			currency: subscriptions.currency,
			createdAt: subscriptions.createdAt,
		})
		.from(subscriptions)
		.orderBy(
			subscriptions.userId,
			desc(subscriptions.createdAt),
			desc(subscriptions.id),
		)
		.as("latest_admin_subscription");
}

export async function queryAdminSubscriptions(
	db: Database,
	input: AdminSubscriptionListInput,
) {
	const latestSubscription = latestSubscriptionQuery(db);
	const conditions: SQL[] = [eq(user.role, USER_ROLES.OWNER)];

	if (input.search) {
		const pattern = `%${input.search}%`;
		const searchCondition = or(
			ilike(user.name, pattern),
			ilike(user.email, pattern),
		);
		if (searchCondition) conditions.push(searchCondition);
	}
	if (input.planSlug) conditions.push(eq(plans.slug, input.planSlug));
	if (input.status === ADMIN_SUBSCRIPTION_STATUS_FILTERS.EXPIRED) {
		conditions.push(eq(latestSubscription.expired, true));
	} else if (input.status) {
		conditions.push(
			and(
				eq(latestSubscription.status, input.status),
				or(
					sql`${latestSubscription.expired} is null`,
					eq(latestSubscription.expired, false),
				),
			) as SQL,
		);
	}

	const whereCondition = and(...conditions);
	const offset = (input.page - 1) * input.pageSize;

	const [[totalRow], rows] = await Promise.all([
		db
			.select({ value: count() })
			.from(user)
			.innerJoin(latestSubscription, eq(latestSubscription.userId, user.id))
			.innerJoin(plans, eq(latestSubscription.planId, plans.id))
			.where(whereCondition),
		db
			.select({
				ownerId: user.id,
				ownerName: user.name,
				ownerEmail: user.email,
				emailVerified: user.emailVerified,
				subscription: {
					id: latestSubscription.id,
					planId: latestSubscription.planId,
					planName: plans.name,
					planSlug: plans.slug,
					status: latestSubscription.status,
					billingInterval: latestSubscription.billingInterval,
					currentPeriodStart: latestSubscription.currentPeriodStart,
					currentPeriodEnd: latestSubscription.currentPeriodEnd,
					nextBillingDate: latestSubscription.nextBillingDate,
					expired: latestSubscription.expired,
					totalPaid: latestSubscription.totalPaid,
					currency: latestSubscription.currency,
				},
			})
			.from(user)
			.innerJoin(latestSubscription, eq(latestSubscription.userId, user.id))
			.innerJoin(plans, eq(latestSubscription.planId, plans.id))
			.where(whereCondition)
			.orderBy(desc(latestSubscription.createdAt), desc(user.id))
			.limit(input.pageSize)
			.offset(offset),
	]);

	const total = totalRow?.value ?? 0;
	return {
		items: rows,
		page: input.page,
		pageSize: input.pageSize,
		total,
		totalPages: Math.ceil(total / input.pageSize),
	};
}

function getPlanPrice(
	plan: typeof plans.$inferSelect,
	interval: BillingInterval,
): number {
	switch (interval) {
		case BILLING_INTERVAL.MONTHLY:
			return plan.priceMonthly;
		case BILLING_INTERVAL.QUARTERLY:
			return plan.priceQuarterly;
		case BILLING_INTERVAL.HALFYEAR:
			return plan.priceHalfYearly;
		case BILLING_INTERVAL.YEAR:
			return plan.priceYearly;
		case BILLING_INTERVAL.TWOYEAR:
			return plan.priceTwoYear;
	}
}

function getIntervalMonths(interval: BillingInterval): number {
	switch (interval) {
		case BILLING_INTERVAL.MONTHLY:
			return 1;
		case BILLING_INTERVAL.QUARTERLY:
			return 3;
		case BILLING_INTERVAL.HALFYEAR:
			return 6;
		case BILLING_INTERVAL.YEAR:
			return 12;
		case BILLING_INTERVAL.TWOYEAR:
			return 24;
	}
}

function addMonths(date: Date, months: number): Date {
	const result = new Date(date);
	result.setUTCMonth(result.getUTCMonth() + months);
	return result;
}

function isUniqueViolation(error: unknown): boolean {
	let current: unknown = error;
	for (let depth = 0; depth < 4 && current; depth += 1) {
		if (
			typeof current === "object" &&
			"code" in current &&
			(current as { code?: string }).code === "23505"
		) {
			return true;
		}
		current =
			typeof current === "object" && "cause" in current
				? (current as { cause?: unknown }).cause
				: undefined;
	}
	return false;
}

export async function recordSubscriptionPayment(
	db: Database,
	adminUserId: string,
	input: RecordSubscriptionPaymentInput,
) {
	const [[owner], [plan], [currentSubscription], [duplicateReference]] =
		await Promise.all([
			db
				.select({ id: user.id, role: user.role })
				.from(user)
				.where(eq(user.id, input.ownerUserId))
				.limit(1),
			db.select().from(plans).where(eq(plans.id, input.planId)).limit(1),
			db
				.select()
				.from(subscriptions)
				.where(eq(subscriptions.userId, input.ownerUserId))
				.orderBy(desc(subscriptions.createdAt), desc(subscriptions.id))
				.limit(1),
			db
				.select({ id: invoices.id })
				.from(invoices)
				.where(
					eq(invoices.externalPaymentReference, input.externalPaymentReference),
				)
				.limit(1),
		]);

	if (!owner || owner.role !== USER_ROLES.OWNER) {
		throw new ORPCError("NOT_FOUND", { message: "Owner account not found." });
	}
	if (!plan) {
		throw new ORPCError("NOT_FOUND", {
			message: "Subscription plan not found.",
		});
	}
	if (!currentSubscription) {
		throw new ORPCError("PRECONDITION_FAILED", {
			message:
				"Owner has no subscription row. Repair account provisioning first.",
		});
	}
	if (duplicateReference) {
		throw new ORPCError("CONFLICT", {
			message: "This external payment reference has already been recorded.",
		});
	}

	const expectedAmount = getPlanPrice(plan, input.billingInterval);
	if (input.amount !== expectedAmount) {
		throw new ORPCError("BAD_REQUEST", {
			message: `Expected ${expectedAmount} paise for this plan and billing interval.`,
		});
	}
	if (input.paidAt.getTime() > Date.now()) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Payment time cannot be in the future.",
		});
	}

	const intervalMonths = getIntervalMonths(input.billingInterval);
	const invoicePeriodStart = input.paidAt;
	const invoicePeriodEnd = addMonths(input.paidAt, intervalMonths);
	const invoiceId = generatedId();
	const auditId = generatedId();
	const now = new Date();
	const nextPeriodEnd = sql<Date>`greatest(coalesce(${subscriptions.currentPeriodEnd}, ${input.paidAt}), ${input.paidAt}) + (${intervalMonths} * interval '1 month')`;
	const nextPeriodStart = sql<Date>`case when ${subscriptions.currentPeriodEnd} > ${input.paidAt} then ${subscriptions.currentPeriodStart} else ${input.paidAt} end`;

	const updateSubscription = (database: Database) =>
		database
			.update(subscriptions)
			.set({
				planId: plan.id,
				status: PLAN_STATUS.ACTIVE,
				expired: false,
				billingInterval: input.billingInterval,
				currentPeriodStart: nextPeriodStart,
				currentPeriodEnd: nextPeriodEnd,
				nextBillingDate: nextPeriodEnd,
				totalPaid: sql`coalesce(${subscriptions.totalPaid}, 0) + ${input.amount}`,
				currency: CURRENCY_TYPES.INR,
				updatedAt: now,
			})
			.where(eq(subscriptions.id, currentSubscription.id))
			.returning();

	const createInvoice = (database: Database) =>
		database
			.insert(invoices)
			.values({
				id: invoiceId,
				subscriptionId: currentSubscription.id,
				userId: owner.id,
				amount: input.amount,
				currency: CURRENCY_TYPES.INR,
				periodStart: invoicePeriodStart,
				periodEnd: invoicePeriodEnd,
				paymentStatus: PAYMENT_STATUS.PAID,
				paymentMethod: input.paymentMethod,
				externalPaymentReference: input.externalPaymentReference,
				paidAt: input.paidAt,
				recordedByAdminUserId: adminUserId,
			})
			.returning();

	const createAudit = (database: Database) =>
		database.insert(adminAuditLogs).values({
			id: auditId,
			actorAdminUserId: adminUserId,
			action: ADMIN_AUDIT_ACTIONS.SUBSCRIPTION_PAYMENT_RECORDED,
			targetType: ADMIN_TARGET_TYPES.SUBSCRIPTION,
			targetId: currentSubscription.id,
			reason: input.reason,
			metadata: {
				ownerUserId: owner.id,
				fromPlanId: currentSubscription.planId,
				toPlanId: plan.id,
				billingInterval: input.billingInterval,
				amount: input.amount,
				paymentMethod: input.paymentMethod,
				externalPaymentReference: input.externalPaymentReference,
			},
		});

	try {
		let updatedSubscription: typeof subscriptions.$inferSelect | undefined;
		let invoice: typeof invoices.$inferSelect | undefined;

		if (supportsDatabaseBatch(db)) {
			const [subscriptionRows, invoiceRows] = await db.batch([
				updateSubscription(db),
				createInvoice(db),
				createAudit(db),
			]);
			updatedSubscription = subscriptionRows[0];
			invoice = invoiceRows[0];
		} else {
			const result = await db.transaction(async (tx) => {
				const transactionDb = tx as unknown as Database;
				const [subscriptionRow] = await updateSubscription(transactionDb);
				const [invoiceRow] = await createInvoice(transactionDb);
				await createAudit(transactionDb);
				return { subscriptionRow, invoiceRow };
			});
			updatedSubscription = result.subscriptionRow;
			invoice = result.invoiceRow;
		}

		if (!updatedSubscription || !invoice) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Payment could not be recorded.",
			});
		}

		return {
			invoice,
			subscription: {
				...updatedSubscription,
				planName: plan.name,
				planSlug: plan.slug,
			},
		};
	} catch (error) {
		if (error instanceof ORPCError) throw error;
		if (isUniqueViolation(error)) {
			throw new ORPCError("CONFLICT", {
				message: "This external payment reference has already been recorded.",
			});
		}
		throw error;
	}
}
