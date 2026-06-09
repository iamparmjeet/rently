export const TENANT_LIMIT = 50;

export const PLAN_STATUS = {
	TRIAL: "trial",
	ACTIVE: "active",
	PAUSED: "paused",
	CANCELLED: "cancelled",
} as const;

export type PlanStatus = (typeof PLAN_STATUS)[keyof typeof PLAN_STATUS];

export const PLAN_STATUS_VALUES = Object.values(PLAN_STATUS) as [
	PlanStatus,
	...PlanStatus[],
];

export const BILLING_INTERVAL = {
	MONTHLY: "monthly",
	QUARTERLY: "quarterly",
	HALFYEAR: "halfyear",
	YEAR: "year",
	TWOYEAR: "twoyear",
} as const;

export type BillingInterval =
	(typeof BILLING_INTERVAL)[keyof typeof BILLING_INTERVAL];

export const BILLING_INTERVAL_VALUES = Object.values(BILLING_INTERVAL) as [
	BillingInterval,
	...BillingInterval[],
];

export const CURRENCY_TYPES = {
	INR: "inr",
	USD: "usd",
} as const;

export type CurrencyTypes =
	(typeof CURRENCY_TYPES)[keyof typeof CURRENCY_TYPES];

export const CURRENCY_TYPES_VALUES = Object.values(CURRENCY_TYPES) as [
	CurrencyTypes,
	...CurrencyTypes[],
];

export const PAYMENT_METHODS = {
	UPI: "upi",
	CASH: "cash",
	BANK_TRANSFER: "bank_transfer",
	CHEQUE: "cheque",
	ONLINE: "online",
} as const;

export type PaymentMethod =
	(typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

export const PAYMENT_METHOD_VALUES = Object.values(PAYMENT_METHODS) as [
	PaymentMethod,
	...PaymentMethod[],
];

export const OWNER_ONLY_PAYMENT_METHODS = {
	CASH: "cash",
	CHEQUE: "cheque",
} as const;

export type OwnerOnlyPaymentMethod =
	(typeof OWNER_ONLY_PAYMENT_METHODS)[keyof typeof OWNER_ONLY_PAYMENT_METHODS];

export const OWNER_ONLY_PAYMENT_METHODS_VALUE = Object.values(
	OWNER_ONLY_PAYMENT_METHODS,
) as [OwnerOnlyPaymentMethod, ...OwnerOnlyPaymentMethod[]];

export const DIGITAL_PAYMENT_METHODS = [
	"upi",
	"bank_transfer",
	"online",
] as const;

export type DigitalPaymentMethod =
	(typeof DIGITAL_PAYMENT_METHODS)[keyof typeof DIGITAL_PAYMENT_METHODS];

export const DIGITAL_PAYMENT_METHODS_VALUE = Object.values(
	DIGITAL_PAYMENT_METHODS,
) as [DigitalPaymentMethod, ...DigitalPaymentMethod[]];

export const PAYMENT_STATUS = {
	UNPAID: "unpaid",
	PAID: "paid",
	FAILED: "failed",
} as const;

export type PaymentStatus =
	(typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const PAYMENT_STATUS_VALUES = Object.values(PAYMENT_STATUS) as [
	PaymentStatus,
	...PaymentStatus[],
];

// [
//   {
//     name: "Basic",
//     tenantLimit: 500,
//     priceMonthly: 499,
//     priceQuarterly: 499 * 3 * 0.95,
//     priceHalfYearly: 499 * 6 * 0.9,
//     priceYearly: 499 * 12 * 0.85,
//     priceTwoYear: 499 * 24 * 0.8,
//   },
//   {
//     name: "Advanced",
//     tenantLimit: null, // unlimited
//     priceMonthly: 1199,
//     priceQuarterly: 1199 * 3 * 0.95,
//     priceHalfYearly: 1199 * 6 * 0.9,
//     priceYearly: 1199 * 12 * 0.85,
//     priceTwoYear: 1199 * 24 * 0.8,
//   },
// ];

// in Paisa
export const RATEPERUNIT = 900;
export const FIXEDCHARGE = 10000;
