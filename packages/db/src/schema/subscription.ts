import {
	BILLING_INTERVAL,
	BILLING_INTERVAL_VALUES,
	CURRENCY_TYPES,
	PAYMENT_METHOD_VALUES,
	PAYMENT_STATUS,
	PAYMENT_STATUS_VALUES,
	PLAN_STATUS,
	PLAN_STATUS_VALUES,
	TENANT_LIMIT,
} from "@rently/db/constants/payment-constants";
import {
	boolean,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { auditColumns, idColumn } from "../utils/columns";
import { user } from "./auth";

export const plans = pgTable("plans", {
	...idColumn(),
	name: text("name").notNull(),
	slug: text("slug").unique(),
	description: text("description"),
	tenantLimit: integer("tenant_limit").notNull().default(TENANT_LIMIT),
	// Billing
	priceMonthly: integer("price_monthly").default(0).notNull(),
	priceQuarterly: integer("price_quarterly").default(0).notNull(),
	priceHalfYearly: integer("price_half_yearly").default(0).notNull(),
	priceYearly: integer("price_yearly").default(0).notNull(),
	priceTwoYear: integer("price_two_year").default(0).notNull(),
	// discount in paise
	discountQuarterly: integer("discount_quarterly").default(500), // 5%
	discountHalfYearly: integer("discount_half_yearly").default(100), // 10%
	discountYearly: integer("discount_yearly").default(150),
	discountTwoYear: integer("discount_two_year").default(200),
	...auditColumns(),
});

export const subscriptions = pgTable(
	"subscriptions",
	{
		...idColumn(),
		userId: uuid("user_id")
			.references(() => user.id)
			.notNull(),
		planId: uuid("plan_id")
			.references(() => plans.id)
			.notNull(),
		status: text("status", {
			enum: PLAN_STATUS_VALUES,
		}).default(PLAN_STATUS.ACTIVE),
		currentPeriodStart: timestamp("current_period_start").defaultNow(),
		currentPeriodEnd: timestamp("current_period_end"),
		nextBillingDate: timestamp("next_billing_date"),
		trialEndsAt: timestamp("trial_ends_at"),
		expired: boolean("expired").default(false),
		billingInterval: text("billing_interval", {
			enum: BILLING_INTERVAL_VALUES,
		})
			.default(BILLING_INTERVAL.MONTHLY)
			.notNull(),
		totalPaid: integer("total_paid").default(0),
		currency: text("currency").default(CURRENCY_TYPES.INR),
		...auditColumns(),
	},
	(table) => [
		index("subscriptions_user_created_at_idx").on(
			table.userId,
			table.createdAt,
		),
		// D01: one subscription row per user. The provisioning upsert races on
		// this index — the loser reads the winner's row instead of inserting.
		uniqueIndex("subscriptions_user_id_unique").on(table.userId),
	],
);

export const invoices = pgTable(
	"invoices",
	{
		...idColumn(),
		subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
			onDelete: "set null",
		}),
		userId: uuid("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" })
			.$type<string>(),
		amount: integer("amount").notNull(),
		currency: text("currency").default(CURRENCY_TYPES.INR),
		periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
		periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
		paymentStatus: text("payment_status", {
			enum: PAYMENT_STATUS_VALUES,
		}).default(PAYMENT_STATUS.UNPAID),
		paymentMethod: text("payment_method", { enum: PAYMENT_METHOD_VALUES }),
		externalPaymentReference: text("external_payment_reference").unique(),
		paidAt: timestamp("paid_at", { withTimezone: true }),
		recordedByAdminUserId: uuid("recorded_by_admin_user_id").references(
			() => user.id,
			{ onDelete: "restrict" },
		),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("invoices_user_created_at_idx").on(table.userId, table.createdAt),
		index("invoices_paid_at_idx").on(table.paidAt),
	],
);

export const betaAccessCodes = pgTable("beta_access_codes", {
	...idColumn(),
	code: text("code").unique().notNull(),
	grantsPlanSlug: text("grants_plan_slug").notNull().default("pro"),
	periodDays: integer("period_days").notNull().default(365),
	maxUses: integer("max_uses").notNull().default(1),
	totalUses: integer("total_uses").notNull().default(0),
	usedByUserId: uuid("used_by_user_id").references(() => user.id),
	usedAt: timestamp("used_at"),
	expiresAt: timestamp("expires_at"), // null = never expires
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

// D02: one redemption per (code, user). The unique index is the same-user
// retry arbiter — a repeated redeem reads as already-redeemed instead of
// burning another use. RESTRICT FKs keep granted entitlements auditable.
export const betaCodeRedemptions = pgTable(
	"beta_code_redemptions",
	{
		...idColumn(),
		codeId: uuid("code_id")
			.notNull()
			.references(() => betaAccessCodes.id, { onDelete: "restrict" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		...auditColumns(),
	},
	(table) => [
		uniqueIndex("beta_code_redemptions_code_user_unique").on(
			table.codeId,
			table.userId,
		),
	],
);
