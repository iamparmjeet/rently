import {
	ADMIN_SUBSCRIPTION_STATUS_FILTER_VALUES,
	BETA_CODE_FILTER_VALUES,
} from "@rently/db/constants/admin-constants";
import {
	BILLING_INTERVAL_VALUES,
	PAYMENT_METHOD_VALUES,
	PAYMENT_STATUS_VALUES,
	PLAN_STATUS_VALUES,
} from "@rently/db/constants/payment-constants";
import { USER_ROLE_VALUES } from "@rently/db/constants/user-roles";
import z from "zod";

const IdSchema = z.uuid();

export const AdminPaginationSchema = z.object({
	page: z.number().int().min(1).default(1),
	pageSize: z.number().int().min(1).max(100).default(25),
});

export const AdminMutationReasonSchema = z
	.string()
	.trim()
	.min(8, "Give a short operational reason (at least 8 characters).")
	.max(500);

export const AdminSubscriptionSummarySchema = z.object({
	id: IdSchema,
	planId: IdSchema,
	planName: z.string(),
	planSlug: z.string().nullable(),
	status: z.enum(PLAN_STATUS_VALUES).nullable(),
	billingInterval: z.enum(BILLING_INTERVAL_VALUES),
	currentPeriodStart: z.date().nullable(),
	currentPeriodEnd: z.date().nullable(),
	nextBillingDate: z.date().nullable(),
	expired: z.boolean().nullable(),
	totalPaid: z.number().int().nullable(),
	currency: z.string().nullable(),
});

export const AdminOverviewSchema = z.object({
	users: z.object({
		owners: z.number().int(),
		tenants: z.number().int(),
		admins: z.number().int(),
		newOwnersLast30Days: z.number().int(),
		newTenantsLast30Days: z.number().int(),
	}),
	emailVerification: z.object({
		verified: z.number().int(),
		unverified: z.number().int(),
	}),
	subscriptions: z.object({
		active: z.number().int(),
		trial: z.number().int(),
		paused: z.number().int(),
		cancelled: z.number().int(),
		expired: z.number().int(),
	}),
	planDistribution: z.array(
		z.object({
			planId: IdSchema,
			planName: z.string(),
			planSlug: z.string().nullable(),
			count: z.number().int(),
		}),
	),
	revenue: z.object({
		platformRevenueLifetime: z.number().int(),
		platformRevenueLast30Days: z.number().int(),
		managedRentVolumeLifetime: z.number().int(),
		managedRentVolumeLast30Days: z.number().int(),
	}),
	recentUsers: z.array(
		z.object({
			id: IdSchema,
			name: z.string(),
			email: z.email(),
			role: z.enum(USER_ROLE_VALUES),
			createdAt: z.date(),
		}),
	),
	recentSubscriptionPayments: z.array(
		z.object({
			invoiceId: IdSchema,
			ownerId: IdSchema,
			ownerName: z.string(),
			ownerEmail: z.email(),
			amount: z.number().int(),
			currency: z.string().nullable(),
			paymentMethod: z.enum(PAYMENT_METHOD_VALUES).nullable(),
			externalPaymentReference: z.string().nullable(),
			paidAt: z.date().nullable(),
		}),
	),
	recentAdminActions: z.array(
		z.object({
			id: IdSchema,
			actorAdminName: z.string(),
			action: z.string(),
			targetType: z.string(),
			targetId: IdSchema.nullable(),
			reason: z.string(),
			createdAt: z.date(),
		}),
	),
});

export const AdminUserListInputSchema = AdminPaginationSchema.extend({
	search: z.string().trim().min(1).max(200).optional(),
	role: z.enum(USER_ROLE_VALUES).optional(),
	emailVerified: z.boolean().optional(),
	planSlug: z.string().trim().min(1).max(80).optional(),
	subscriptionStatus: z
		.enum(ADMIN_SUBSCRIPTION_STATUS_FILTER_VALUES)
		.optional(),
	createdFrom: z.date().optional(),
	createdTo: z.date().optional(),
});

export const AdminUserListItemSchema = z.object({
	id: IdSchema,
	name: z.string(),
	email: z.email(),
	role: z.enum(USER_ROLE_VALUES),
	emailVerified: z.boolean(),
	createdAt: z.date(),
	subscription: AdminSubscriptionSummarySchema.nullable(),
});

export const AdminUserListResponseSchema = z.object({
	items: z.array(AdminUserListItemSchema),
	page: z.number().int(),
	pageSize: z.number().int(),
	total: z.number().int(),
	totalPages: z.number().int(),
});

export const AdminUserIdSchema = z.object({ userId: IdSchema });

export const AdminInvoiceSchema = z.object({
	id: IdSchema,
	subscriptionId: IdSchema.nullable(),
	amount: z.number().int(),
	currency: z.string().nullable(),
	paymentStatus: z.enum(PAYMENT_STATUS_VALUES).nullable(),
	paymentMethod: z.enum(PAYMENT_METHOD_VALUES).nullable(),
	externalPaymentReference: z.string().nullable(),
	periodStart: z.date(),
	periodEnd: z.date(),
	paidAt: z.date().nullable(),
	createdAt: z.date(),
});

export const AdminBetaCodeHistorySchema = z.object({
	id: IdSchema,
	code: z.string(),
	grantsPlanSlug: z.string(),
	maxUses: z.number().int(),
	totalUses: z.number().int(),
	usedAt: z.date().nullable(),
	expiresAt: z.date().nullable(),
});

export const AdminUserDetailResponseSchema = z.object({
	user: AdminUserListItemSchema,
	subscriptionHistory: z.array(AdminSubscriptionSummarySchema),
	invoices: z.array(AdminInvoiceSchema),
	betaCodes: z.array(AdminBetaCodeHistorySchema),
	ownerSummary: z
		.object({
			propertyCount: z.number().int(),
			unitCount: z.number().int(),
			tenantCount: z.number().int(),
			activeLeaseCount: z.number().int(),
		})
		.nullable(),
	tenantSummary: z
		.object({
			activeLease: z
				.object({
					id: IdSchema,
					status: z.string(),
					propertyName: z.string(),
					unitNumber: z.string(),
					ownerId: IdSchema,
					ownerName: z.string(),
					ownerEmail: z.email(),
				})
				.nullable(),
		})
		.nullable(),
	invites: z.array(
		z.object({
			id: IdSchema,
			status: z.string(),
			deliveryStatus: z.string(),
			deliveryErrorCode: z.string().nullable(),
			lastSentAt: z.date().nullable(),
			expiresAt: z.date().nullable(),
			createdAt: z.date(),
		}),
	),
	operationalEvents: z.array(
		z.object({
			id: IdSchema,
			action: z.string(),
			reason: z.string(),
			createdAt: z.date(),
		}),
	),
});

export const AdminSubscriptionListInputSchema = AdminPaginationSchema.extend({
	search: z.string().trim().min(1).max(200).optional(),
	planSlug: z.string().trim().min(1).max(80).optional(),
	status: z.enum(ADMIN_SUBSCRIPTION_STATUS_FILTER_VALUES).optional(),
});

export const AdminSubscriptionListResponseSchema = z.object({
	items: z.array(
		z.object({
			ownerId: IdSchema,
			ownerName: z.string(),
			ownerEmail: z.email(),
			emailVerified: z.boolean(),
			subscription: AdminSubscriptionSummarySchema,
		}),
	),
	page: z.number().int(),
	pageSize: z.number().int(),
	total: z.number().int(),
	totalPages: z.number().int(),
});

export const RecordSubscriptionPaymentSchema = z.object({
	ownerUserId: IdSchema,
	planId: IdSchema,
	billingInterval: z.enum(BILLING_INTERVAL_VALUES),
	amount: z.number().int().positive(),
	paymentMethod: z.enum(PAYMENT_METHOD_VALUES),
	externalPaymentReference: z
		.string()
		.trim()
		.min(6)
		.max(120)
		.transform((value) => value.toUpperCase()),
	paidAt: z.date(),
	reason: AdminMutationReasonSchema,
});

export const RecordSubscriptionPaymentResponseSchema = z.object({
	invoice: AdminInvoiceSchema,
	subscription: AdminSubscriptionSummarySchema,
});

export const AdminBetaCodeListInputSchema = AdminPaginationSchema.extend({
	search: z.string().trim().min(1).max(200).optional(),
	status: z.enum(BETA_CODE_FILTER_VALUES).default("all"),
});

export const AdminBetaCodeSchema = z.object({
	id: IdSchema,
	code: z.string(),
	grantsPlanSlug: z.string(),
	periodDays: z.number().int(),
	maxUses: z.number().int(),
	totalUses: z.number().int(),
	usedByUserId: IdSchema.nullable(),
	usedByName: z.string().nullable(),
	usedByEmail: z.email().nullable(),
	usedAt: z.date().nullable(),
	expiresAt: z.date().nullable(),
	createdAt: z.date(),
	state: z.enum(["active", "expired", "exhausted"]),
});

export const AdminBetaCodeListResponseSchema = z.object({
	items: z.array(AdminBetaCodeSchema),
	page: z.number().int(),
	pageSize: z.number().int(),
	total: z.number().int(),
	totalPages: z.number().int(),
});

export const CreateAdminBetaCodeSchema = z.object({
	grantsPlanSlug: z.string().trim().min(1).max(80),
	periodDays: z.number().int().min(1).max(3650),
	maxUses: z.number().int().min(1).max(10_000),
	expiresAt: z.date().nullable(),
	reason: AdminMutationReasonSchema,
});

export const ExpireAdminBetaCodeSchema = z.object({
	betaCodeId: IdSchema,
	reason: AdminMutationReasonSchema,
});

export const AdminAuditLogListInputSchema = AdminPaginationSchema.extend({
	actorAdminUserId: IdSchema.optional(),
	action: z.string().trim().min(1).max(120).optional(),
	targetType: z.string().trim().min(1).max(120).optional(),
});

export const AdminAuditLogListResponseSchema = z.object({
	items: z.array(
		z.object({
			id: IdSchema,
			actorAdminUserId: IdSchema,
			actorAdminName: z.string(),
			actorAdminEmail: z.email(),
			action: z.string(),
			targetType: z.string(),
			targetId: IdSchema.nullable(),
			reason: z.string(),
			metadata: z.record(z.string(), z.unknown()),
			createdAt: z.date(),
		}),
	),
	page: z.number().int(),
	pageSize: z.number().int(),
	total: z.number().int(),
	totalPages: z.number().int(),
});

export type AdminOverview = z.infer<typeof AdminOverviewSchema>;
export type AdminUserListInput = z.infer<typeof AdminUserListInputSchema>;
export type AdminUserListResponse = z.infer<typeof AdminUserListResponseSchema>;
export type AdminSubscriptionListResponse = z.infer<
	typeof AdminSubscriptionListResponseSchema
>;
export type AdminSubscriptionListInput = z.infer<
	typeof AdminSubscriptionListInputSchema
>;
export type RecordSubscriptionPaymentInput = z.infer<
	typeof RecordSubscriptionPaymentSchema
>;
export type AdminBetaCodeListInput = z.infer<
	typeof AdminBetaCodeListInputSchema
>;
export type AdminBetaCodeListResponse = z.infer<
	typeof AdminBetaCodeListResponseSchema
>;
export type CreateAdminBetaCodeInput = z.infer<
	typeof CreateAdminBetaCodeSchema
>;
export type ExpireAdminBetaCodeInput = z.infer<
	typeof ExpireAdminBetaCodeSchema
>;
export type AdminAuditLogListInput = z.infer<
	typeof AdminAuditLogListInputSchema
>;
