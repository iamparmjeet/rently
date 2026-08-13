import type { Database } from "@rently/db";
import {
	PAYMENT_STATUS,
	PLAN_STATUS,
} from "@rently/db/constants/payment-constants";
import { PAYMENT_TYPES } from "@rently/db/constants/rent-constants";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import {
	ACCOUNT_MODES,
	WORKSPACE_MODES,
} from "@rently/db/constants/workspace-modes";
import { adminAuditLogs } from "@rently/db/schema/admin";
import { user } from "@rently/db/schema/auth";
import { leases, payments, properties, units } from "@rently/db/schema/schema";
import { invoices, plans, subscriptions } from "@rently/db/schema/subscription";
import type { AdminOverview } from "@rently/validators";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

function latestSubscriptionQuery(db: Database) {
	return db
		.selectDistinctOn([subscriptions.userId], {
			id: subscriptions.id,
			userId: subscriptions.userId,
			planId: subscriptions.planId,
			status: subscriptions.status,
			expired: subscriptions.expired,
			createdAt: subscriptions.createdAt,
		})
		.from(subscriptions)
		.innerJoin(user, eq(subscriptions.userId, user.id))
		.where(eq(user.accountMode, ACCOUNT_MODES.STANDARD))
		.orderBy(
			subscriptions.userId,
			desc(subscriptions.createdAt),
			desc(subscriptions.id),
		)
		.as("latest_admin_overview_subscription");
}

export async function queryAdminOverview(
	db: Database,
	now = new Date(),
): Promise<AdminOverview> {
	const latestSubscription = latestSubscriptionQuery(db);
	const thirtyDaysAgo = new Date(now);
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	const [
		[userMetrics],
		[subscriptionMetrics],
		planDistribution,
		[platformRevenue],
		[managedRentVolume],
		recentUsers,
		recentSubscriptionPayments,
		recentAdminActions,
	] = await Promise.all([
		db
			.select({
				owners:
					sql<number>`count(*) filter (where ${user.role} = ${USER_ROLES.OWNER})`.mapWith(
						Number,
					),
				tenants:
					sql<number>`count(*) filter (where ${user.role} = ${USER_ROLES.TENANT})`.mapWith(
						Number,
					),
				admins:
					sql<number>`count(*) filter (where ${user.role} = ${USER_ROLES.ADMIN})`.mapWith(
						Number,
					),
				newOwnersLast30Days:
					sql<number>`count(*) filter (where ${user.role} = ${USER_ROLES.OWNER} and ${user.createdAt} >= ${thirtyDaysAgo})`.mapWith(
						Number,
					),
				newTenantsLast30Days:
					sql<number>`count(*) filter (where ${user.role} = ${USER_ROLES.TENANT} and ${user.createdAt} >= ${thirtyDaysAgo})`.mapWith(
						Number,
					),
				verified:
					sql<number>`count(*) filter (where ${user.emailVerified} = true)`.mapWith(
						Number,
					),
				unverified:
					sql<number>`count(*) filter (where ${user.emailVerified} = false)`.mapWith(
						Number,
					),
			})
			.from(user)
			.where(eq(user.accountMode, ACCOUNT_MODES.STANDARD)),

		db
			.select({
				active:
					sql<number>`count(*) filter (where ${latestSubscription.status} = ${PLAN_STATUS.ACTIVE} and ${latestSubscription.expired} is not true)`.mapWith(
						Number,
					),
				trial:
					sql<number>`count(*) filter (where ${latestSubscription.status} = ${PLAN_STATUS.TRIAL} and ${latestSubscription.expired} is not true)`.mapWith(
						Number,
					),
				paused:
					sql<number>`count(*) filter (where ${latestSubscription.status} = ${PLAN_STATUS.PAUSED} and ${latestSubscription.expired} is not true)`.mapWith(
						Number,
					),
				cancelled:
					sql<number>`count(*) filter (where ${latestSubscription.status} = ${PLAN_STATUS.CANCELLED} and ${latestSubscription.expired} is not true)`.mapWith(
						Number,
					),
				expired:
					sql<number>`count(*) filter (where ${latestSubscription.expired} = true)`.mapWith(
						Number,
					),
			})
			.from(latestSubscription),

		db
			.select({
				planId: plans.id,
				planName: plans.name,
				planSlug: plans.slug,
				count: sql<number>`count(${latestSubscription.id})`.mapWith(Number),
			})
			.from(plans)
			.leftJoin(latestSubscription, eq(latestSubscription.planId, plans.id))
			.groupBy(plans.id, plans.name, plans.slug)
			.orderBy(plans.priceMonthly),

		db
			.select({
				lifetime:
					sql<number>`coalesce(sum(${invoices.amount}) filter (where ${invoices.paymentStatus} = ${PAYMENT_STATUS.PAID}), 0)`.mapWith(
						Number,
					),
				last30Days:
					sql<number>`coalesce(sum(${invoices.amount}) filter (where ${invoices.paymentStatus} = ${PAYMENT_STATUS.PAID} and coalesce(${invoices.paidAt}, ${invoices.createdAt}) >= ${thirtyDaysAgo}), 0)`.mapWith(
						Number,
					),
			})
			.from(invoices)
			.innerJoin(user, eq(invoices.userId, user.id))
			.where(eq(user.accountMode, ACCOUNT_MODES.STANDARD)),

		db
			.select({
				lifetime: sql<number>`coalesce(sum(${payments.amount}), 0)`.mapWith(
					Number,
				),
				last30Days:
					sql<number>`coalesce(sum(${payments.amount}) filter (where ${payments.paymentDate} >= ${thirtyDaysAgo}), 0)`.mapWith(
						Number,
					),
			})
			.from(payments)
			.innerJoin(leases, eq(payments.leaseId, leases.id))
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.innerJoin(user, eq(properties.ownerId, user.id))
			.where(
				and(
					inArray(payments.type, [
						PAYMENT_TYPES.RENT,
						PAYMENT_TYPES.UTILITY,
						PAYMENT_TYPES.DEPOSIT,
						PAYMENT_TYPES.REVERSAL,
					]),
					eq(user.workspaceMode, WORKSPACE_MODES.LIVE),
				),
			),

		db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				role: user.role,
				createdAt: user.createdAt,
			})
			.from(user)
			.where(eq(user.accountMode, ACCOUNT_MODES.STANDARD))
			.orderBy(desc(user.createdAt), desc(user.id))
			.limit(10),

		db
			.select({
				invoiceId: invoices.id,
				ownerId: user.id,
				ownerName: user.name,
				ownerEmail: user.email,
				amount: invoices.amount,
				currency: invoices.currency,
				paymentMethod: invoices.paymentMethod,
				externalPaymentReference: invoices.externalPaymentReference,
				paidAt: invoices.paidAt,
			})
			.from(invoices)
			.innerJoin(user, eq(invoices.userId, user.id))
			.where(
				and(
					eq(invoices.paymentStatus, PAYMENT_STATUS.PAID),
					eq(user.accountMode, ACCOUNT_MODES.STANDARD),
				),
			)
			.orderBy(desc(invoices.paidAt), desc(invoices.createdAt))
			.limit(10),

		db
			.select({
				id: adminAuditLogs.id,
				actorAdminName: user.name,
				action: adminAuditLogs.action,
				targetType: adminAuditLogs.targetType,
				targetId: adminAuditLogs.targetId,
				reason: adminAuditLogs.reason,
				createdAt: adminAuditLogs.createdAt,
			})
			.from(adminAuditLogs)
			.innerJoin(user, eq(adminAuditLogs.actorAdminUserId, user.id))
			.orderBy(desc(adminAuditLogs.createdAt), desc(adminAuditLogs.id))
			.limit(10),
	]);

	return {
		users: {
			owners: userMetrics?.owners ?? 0,
			tenants: userMetrics?.tenants ?? 0,
			admins: userMetrics?.admins ?? 0,
			newOwnersLast30Days: userMetrics?.newOwnersLast30Days ?? 0,
			newTenantsLast30Days: userMetrics?.newTenantsLast30Days ?? 0,
		},
		emailVerification: {
			verified: userMetrics?.verified ?? 0,
			unverified: userMetrics?.unverified ?? 0,
		},
		subscriptions: {
			active: subscriptionMetrics?.active ?? 0,
			trial: subscriptionMetrics?.trial ?? 0,
			paused: subscriptionMetrics?.paused ?? 0,
			cancelled: subscriptionMetrics?.cancelled ?? 0,
			expired: subscriptionMetrics?.expired ?? 0,
		},
		planDistribution,
		revenue: {
			platformRevenueLifetime: platformRevenue?.lifetime ?? 0,
			platformRevenueLast30Days: platformRevenue?.last30Days ?? 0,
			managedRentVolumeLifetime: managedRentVolume?.lifetime ?? 0,
			managedRentVolumeLast30Days: managedRentVolume?.last30Days ?? 0,
		},
		recentUsers,
		recentSubscriptionPayments,
		recentAdminActions,
	};
}
