export const TENANT_LIMIT = 500;

export const PLAN_STATUS = {
  TRIAL: "trial",
  ACTIVE: "active",
  PAUSED: "paused",
  CANCELLED: "cancelled",
} as const;

export const PLAN_STATUS_VALUES = [
  PLAN_STATUS.TRIAL,
  PLAN_STATUS.ACTIVE,
  PLAN_STATUS.PAUSED,
  PLAN_STATUS.CANCELLED,
] as const;

export type PLAN_STATUS = (typeof PLAN_STATUS)[keyof typeof PLAN_STATUS];

export const BILLING_INTERVAL = {
  MONTHLY: "monthly",
  QUARTERLY: "quarterly",
  HALFYEAR: "halfyear",
  YEAR: "year",
  TWOYEAR: "twoyear",
} as const;

export const BILLING_INTERVAL_VALUES = [
  BILLING_INTERVAL.MONTHLY,
  BILLING_INTERVAL.QUARTERLY,
  BILLING_INTERVAL.HALFYEAR,
  BILLING_INTERVAL.YEAR,
  BILLING_INTERVAL.TWOYEAR,
] as const;

export type BILLING_INTERVAL =
  (typeof BILLING_INTERVAL)[keyof typeof BILLING_INTERVAL];

export const CURRENCY_TYPES = {
  INR: "inr",
  USD: "usd",
} as const;

export const CURRENCY_TYPES_VALUES = [
  CURRENCY_TYPES.INR,
  CURRENCY_TYPES.USD,
] as const;

export type CURRENCY_TYPES =
  (typeof CURRENCY_TYPES)[keyof typeof CURRENCY_TYPES];

export const PAYMENT_STATUS = {
  PENDING: "pending",
  PAID: "paid",
  FAILED: "failed",
} as const;

export const PAYMENT_STATUS_VALUES = [
  PAYMENT_STATUS.PENDING,
  PAYMENT_STATUS.PAID,
  PAYMENT_STATUS.FAILED,
] as const;

export type PAYMENT_STATUS =
  (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

[
  {
    name: "Basic",
    tenantLimit: 500,
    priceMonthly: 499,
    priceQuarterly: 499 * 3 * 0.95,
    priceHalfYearly: 499 * 6 * 0.9,
    priceYearly: 499 * 12 * 0.85,
    priceTwoYear: 499 * 24 * 0.8,
  },
  {
    name: "Advanced",
    tenantLimit: null, // unlimited
    priceMonthly: 1199,
    priceQuarterly: 1199 * 3 * 0.95,
    priceHalfYearly: 1199 * 6 * 0.9,
    priceYearly: 1199 * 12 * 0.85,
    priceTwoYear: 1199 * 24 * 0.8,
  },
];
