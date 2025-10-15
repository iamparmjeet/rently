import { integer, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";
import {
  BILLING_INTERVAL,
  BILLING_INTERVAL_VALUES,
  CURRENCY_TYPES,
  PAYMENT_STATUS,
  PAYMENT_STATUS_VALUES,
  PLAN_STATUS,
  PLAN_STATUS_VALUES,
  TENANT_LIMIT,
} from "@/constants/payment-constats";
import { generateUUID } from "@/utils";
import { user } from "./auth";

export const plans = pgTable("plans", {
  id: text("id").primaryKey().$defaultFn(generateUUID),
  name: text("name").notNull(),
  description: text("description"),
  tenantLimit: integer("tenant_limit").notNull().default(TENANT_LIMIT),
  // Billing
  priceMonthly: real("price_monthly").default(0).notNull(),
  priceQuarterly: real("price_quarterly").default(0).notNull(),
  priceHalfYearly: real("price_half_yearly").default(0).notNull(),
  priceYearly: real("price_yearly").default(0).notNull(),
  priceTwoYear: real("price_two_year").default(0).notNull(),
  // discount
  discountQuarterly: real("discount_quarterly").default(0.05), // 5%
  discountHalfYearly: real("discount_half_yearly").default(0.1), // 10%
  discountYearly: real("discount_yearly").default(0.15),
  discountTwoYear: real("discount_two_year").default(0.2),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: text("id").primaryKey().$defaultFn(generateUUID),
  userId: text("user_id")
    .references(() => user.id)
    .notNull(),
  planId: text("plan_id")
    .references(() => plans.id)
    .notNull(),

  status: text("status", {
    enum: PLAN_STATUS_VALUES,
  }).default(PLAN_STATUS.TRIAL),

  currentPeriodStart: timestamp("current_period_start").defaultNow(),
  currentPeriodEnd: timestamp("current_period_end"),
  trialEndsAt: timestamp("trial_ends_at"),

  billingInterval: text("billing_interval", {
    enum: BILLING_INTERVAL_VALUES,
  })
    .default(BILLING_INTERVAL.MONTHLY)
    .notNull(),

  nextBillingDate: timestamp("next_billing_date"),

  totalPaid: real("total_paid").default(0),
  currency: text("currency").default(CURRENCY_TYPES.INR),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const invoices = pgTable("invoices", {
  id: text("id").primaryKey().$defaultFn(generateUUID),
  subscriptionId: text("subscription_id").references(() => subscriptions.id, {
    onDelete: "cascade",
  }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" })
    .$type<string>(),
  amount: real("amount").notNull(),
  currency: text("currency").default(CURRENCY_TYPES.INR),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  paymentStatus: text("payment_status", {
    enum: PAYMENT_STATUS_VALUES,
  }).default(PAYMENT_STATUS.PENDING),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
