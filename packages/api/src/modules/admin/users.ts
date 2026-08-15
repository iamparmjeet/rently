import { ORPCError } from "@orpc/server";
import type { Database } from "@rently/db";
import { ADMIN_SUBSCRIPTION_STATUS_FILTERS } from "@rently/db/constants/admin-constants";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import { adminAuditLogs } from "@rently/db/schema/admin";
import { user } from "@rently/db/schema/auth";
import {
	leases,
	properties,
	tenantInvites,
	units,
} from "@rently/db/schema/schema";
import {
	betaAccessCodes,
	invoices,
	plans,
	subscriptions,
} from "@rently/db/schema/subscription";
import type {
	AdminUserListInput,
	AdminUserListResponse,
} from "@rently/validators";
import {
	and,
	count,
	countDistinct,
	desc,
	eq,
	gte,
	ilike,
	isNull,
	lte,
	or,
	type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

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
		.as("latest_admin_user_subscription");
}

export async function queryAdminUsers(
	db: Database,
	input: AdminUserListInput,
): Promise<AdminUserListResponse> {
	const latestSubscription = latestSubscriptionQuery(db);
	const conditions: SQL[] = [];

	if (input.role) conditions.push(eq(user.role, input.role));
	if (input.emailVerified !== undefined) {
		conditions.push(eq(user.emailVerified, input.emailVerified));
	}
	if (input.createdFrom)
		conditions.push(gte(user.createdAt, input.createdFrom));
	if (input.createdTo) conditions.push(lte(user.createdAt, input.createdTo));
	if (input.planSlug) conditions.push(eq(plans.slug, input.planSlug));
	if (input.subscriptionStatus === ADMIN_SUBSCRIPTION_STATUS_FILTERS.EXPIRED) {
		conditions.push(eq(latestSubscription.expired, true));
	} else if (input.subscriptionStatus) {
		conditions.push(
			and(
				eq(latestSubscription.status, input.subscriptionStatus),
				or(
					isNull(latestSubscription.expired),
					eq(latestSubscription.expired, false),
				),
			) as SQL,
		);
	}
	if (input.search) {
		const pattern = `%${input.search}%`;
		const searchCondition = or(
			ilike(user.name, pattern),
			ilike(user.email, pattern),
		);
		if (searchCondition) conditions.push(searchCondition);
	}

	const whereCondition = conditions.length ? and(...conditions) : undefined;
	const offset = (input.page - 1) * input.pageSize;

	const baseQuery = db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
			emailVerified: user.emailVerified,
			createdAt: user.createdAt,
			subscriptionId: latestSubscription.id,
			planId: latestSubscription.planId,
			planName: plans.name,
			planSlug: plans.slug,
			subscriptionStatus: latestSubscription.status,
			billingInterval: latestSubscription.billingInterval,
			currentPeriodStart: latestSubscription.currentPeriodStart,
			currentPeriodEnd: latestSubscription.currentPeriodEnd,
			nextBillingDate: latestSubscription.nextBillingDate,
			expired: latestSubscription.expired,
			totalPaid: latestSubscription.totalPaid,
			currency: latestSubscription.currency,
		})
		.from(user)
		.leftJoin(latestSubscription, eq(latestSubscription.userId, user.id))
		.leftJoin(plans, eq(latestSubscription.planId, plans.id))
		.where(whereCondition);

	const [[totalRow], rows] = await Promise.all([
		db
			.select({ value: count() })
			.from(user)
			.leftJoin(latestSubscription, eq(latestSubscription.userId, user.id))
			.leftJoin(plans, eq(latestSubscription.planId, plans.id))
			.where(whereCondition),
		baseQuery
			.orderBy(desc(user.createdAt), desc(user.id))
			.limit(input.pageSize)
			.offset(offset),
	]);

	const items = rows.map((row) => ({
		id: row.id,
		name: row.name,
		email: row.email,
		role: row.role,
		emailVerified: row.emailVerified,
		createdAt: row.createdAt,
		subscription:
			row.subscriptionId && row.planId && row.planName && row.billingInterval
				? {
						id: row.subscriptionId,
						planId: row.planId,
						planName: row.planName,
						planSlug: row.planSlug,
						status: row.subscriptionStatus,
						billingInterval: row.billingInterval,
						currentPeriodStart: row.currentPeriodStart,
						currentPeriodEnd: row.currentPeriodEnd,
						nextBillingDate: row.nextBillingDate,
						expired: row.expired,
						totalPaid: row.totalPaid,
						currency: row.currency,
					}
				: null,
	}));

	const total = totalRow?.value ?? 0;
	return {
		items,
		page: input.page,
		pageSize: input.pageSize,
		total,
		totalPages: Math.ceil(total / input.pageSize),
	};
}

export async function queryAdminUserDetail(db: Database, userId: string) {
	const [targetUser] = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
			emailVerified: user.emailVerified,
			createdAt: user.createdAt,
		})
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);

	if (!targetUser) {
		throw new ORPCError("NOT_FOUND", { message: "User not found." });
	}

	const ownerUser = alias(user, "admin_owner_user");
	const auditSubscription = alias(subscriptions, "admin_audit_subscription");

	const [
		subscriptionRows,
		invoiceRows,
		betaCodeRows,
		inviteRows,
		[propertyCountRow],
		[unitCountRow],
		[tenantCountRow],
		[activeLeaseCountRow],
		activeLeaseRows,
		operationalEvents,
	] = await Promise.all([
		db
			.select({
				id: subscriptions.id,
				planId: subscriptions.planId,
				planName: plans.name,
				planSlug: plans.slug,
				status: subscriptions.status,
				billingInterval: subscriptions.billingInterval,
				currentPeriodStart: subscriptions.currentPeriodStart,
				currentPeriodEnd: subscriptions.currentPeriodEnd,
				nextBillingDate: subscriptions.nextBillingDate,
				expired: subscriptions.expired,
				totalPaid: subscriptions.totalPaid,
				currency: subscriptions.currency,
			})
			.from(subscriptions)
			.innerJoin(plans, eq(subscriptions.planId, plans.id))
			.where(eq(subscriptions.userId, userId))
			.orderBy(desc(subscriptions.createdAt), desc(subscriptions.id))
			.limit(25),

		db
			.select({
				id: invoices.id,
				subscriptionId: invoices.subscriptionId,
				amount: invoices.amount,
				currency: invoices.currency,
				paymentStatus: invoices.paymentStatus,
				paymentMethod: invoices.paymentMethod,
				externalPaymentReference: invoices.externalPaymentReference,
				periodStart: invoices.periodStart,
				periodEnd: invoices.periodEnd,
				paidAt: invoices.paidAt,
				createdAt: invoices.createdAt,
			})
			.from(invoices)
			.where(eq(invoices.userId, userId))
			.orderBy(desc(invoices.createdAt), desc(invoices.id))
			.limit(25),

		db
			.select({
				id: betaAccessCodes.id,
				code: betaAccessCodes.code,
				grantsPlanSlug: betaAccessCodes.grantsPlanSlug,
				maxUses: betaAccessCodes.maxUses,
				totalUses: betaAccessCodes.totalUses,
				usedAt: betaAccessCodes.usedAt,
				expiresAt: betaAccessCodes.expiresAt,
			})
			.from(betaAccessCodes)
			.where(eq(betaAccessCodes.usedByUserId, userId))
			.orderBy(desc(betaAccessCodes.usedAt))
			.limit(25),

		db
			.select({
				id: tenantInvites.id,
				status: tenantInvites.status,
				deliveryStatus: tenantInvites.deliveryStatus,
				deliveryErrorCode: tenantInvites.deliveryErrorCode,
				lastSentAt: tenantInvites.lastSentAt,
				expiresAt: tenantInvites.expiresAt,
				createdAt: tenantInvites.createdAt,
			})
			.from(tenantInvites)
			.where(eq(tenantInvites.email, targetUser.email))
			.orderBy(desc(tenantInvites.createdAt))
			.limit(10),

		db
			.select({ value: count() })
			.from(properties)
			.where(and(eq(properties.ownerId, userId), isNull(properties.deletedAt))),

		db
			.select({ value: count() })
			.from(units)
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.where(
				and(
					eq(properties.ownerId, userId),
					isNull(properties.deletedAt),
					isNull(units.deletedAt),
				),
			),

		db
			.select({ value: countDistinct(leases.tenantId) })
			.from(leases)
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.where(
				and(
					eq(properties.ownerId, userId),
					isNull(properties.deletedAt),
					isNull(units.deletedAt),
				),
			),

		db
			.select({ value: count() })
			.from(leases)
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.where(
				and(
					eq(properties.ownerId, userId),
					eq(leases.status, "active"),
					isNull(properties.deletedAt),
					isNull(units.deletedAt),
				),
			),

		db
			.select({
				id: leases.id,
				status: leases.status,
				propertyName: properties.name,
				unitNumber: units.unitNumber,
				ownerId: ownerUser.id,
				ownerName: ownerUser.name,
				ownerEmail: ownerUser.email,
			})
			.from(leases)
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.innerJoin(ownerUser, eq(properties.ownerId, ownerUser.id))
			.where(
				and(
					eq(leases.tenantId, userId),
					eq(leases.status, "active"),
					isNull(properties.deletedAt),
					isNull(units.deletedAt),
				),
			)
			.orderBy(desc(leases.createdAt))
			.limit(1),

		db
			.select({
				id: adminAuditLogs.id,
				action: adminAuditLogs.action,
				reason: adminAuditLogs.reason,
				createdAt: adminAuditLogs.createdAt,
			})
			.from(adminAuditLogs)
			.innerJoin(
				auditSubscription,
				eq(adminAuditLogs.targetId, auditSubscription.id),
			)
			.where(eq(auditSubscription.userId, userId))
			.orderBy(desc(adminAuditLogs.createdAt))
			.limit(20),
	]);

	const currentSubscription = subscriptionRows[0] ?? null;

	return {
		user: {
			...targetUser,
			subscription: currentSubscription,
		},
		subscriptionHistory: subscriptionRows,
		invoices: invoiceRows,
		betaCodes: betaCodeRows,
		ownerSummary:
			targetUser.role === USER_ROLES.OWNER
				? {
						propertyCount: propertyCountRow?.value ?? 0,
						unitCount: unitCountRow?.value ?? 0,
						tenantCount: tenantCountRow?.value ?? 0,
						activeLeaseCount: activeLeaseCountRow?.value ?? 0,
					}
				: null,
		tenantSummary:
			targetUser.role === USER_ROLES.TENANT
				? { activeLease: activeLeaseRows[0] ?? null }
				: null,
		invites: inviteRows,
		operationalEvents,
	};
}
