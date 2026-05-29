import {
	BILLING_INTERVAL,
	BILLING_INTERVAL_VALUES,
	CURRENCY_TYPES,
	PAYMENT_STATUS,
	PAYMENT_STATUS_VALUES,
	PLAN_STATUS,
	PLAN_STATUS_VALUES,
	TENANT_LIMIT,
} from "@rently/db/constants/payment-constants";
import {
	boolean,
	integer,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { auditColumns, idColumn } from "../utils/columns";
import { user } from "./auth";

export const plans = pgTable("plans", {
	...idColumn(),
	name: text("name").notNull(),
	description: text("description"),
	tenantLimit: integer("tenant_limit").notNull().default(TENANT_LIMIT),
	// Billing
	priceMonthly: integer("price_monthly").default(0).notNull(),
	priceQuarterly: integer("price_quarterly").default(0).notNull(),
	priceHalfYearly: integer("price_half_yearly").default(0).notNull(),
	priceYearly: integer("price_yearly").default(0).notNull(),
	priceTwoYear: integer("price_two_year").default(0).notNull(),
	// discount
	discountQuarterly: integer("discount_quarterly").default(0.05), // 5%
	discountHalfYearly: integer("discount_half_yearly").default(0.1), // 10%
	discountYearly: integer("discount_yearly").default(0.15),
	discountTwoYear: integer("discount_two_year").default(0.2),

	...auditColumns(),
});

export const subscriptions = pgTable("subscriptions", {
	...idColumn(),
	userId: uuid("user_id")
		.references(() => user.id)
		.notNull(),
	planId: uuid("plan_id")
		.references(() => plans.id)
		.notNull(),

	status: text("status", {
		enum: PLAN_STATUS_VALUES,
	}).default(PLAN_STATUS.TRIAL),

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
});

export const invoices = pgTable("invoices", {
	...idColumn(),
	subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
		onDelete: "cascade",
	}),
	userId: uuid("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" })
		.$type<string>(),
	amount: integer("amount").notNull(),
	currency: text("currency").default(CURRENCY_TYPES.INR),
	periodStart: text("period_start").notNull(),
	periodEnd: text("period_end").notNull(),
	paymentStatus: text("payment_status", {
		enum: PAYMENT_STATUS_VALUES,
	}).default(PAYMENT_STATUS.PENDING),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});
