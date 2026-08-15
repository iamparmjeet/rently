export const ADMIN_AUDIT_ACTIONS = {
	SUBSCRIPTION_PAYMENT_RECORDED: "subscription.payment_recorded",
	BETA_CODE_CREATED: "beta_code.created",
	BETA_CODE_EXPIRED: "beta_code.expired",
} as const;

export type AdminAuditAction =
	(typeof ADMIN_AUDIT_ACTIONS)[keyof typeof ADMIN_AUDIT_ACTIONS];

export const ADMIN_TARGET_TYPES = {
	SUBSCRIPTION: "subscription",
	BETA_CODE: "beta_code",
} as const;

export type AdminTargetType =
	(typeof ADMIN_TARGET_TYPES)[keyof typeof ADMIN_TARGET_TYPES];

export const BETA_CODE_FILTERS = {
	ALL: "all",
	ACTIVE: "active",
	EXPIRED: "expired",
	EXHAUSTED: "exhausted",
	UNUSED: "unused",
} as const;

export type BetaCodeFilter =
	(typeof BETA_CODE_FILTERS)[keyof typeof BETA_CODE_FILTERS];

export const BETA_CODE_FILTER_VALUES = Object.values(BETA_CODE_FILTERS) as [
	BetaCodeFilter,
	...BetaCodeFilter[],
];

export const ADMIN_SUBSCRIPTION_STATUS_FILTERS = {
	...PLAN_STATUS,
	EXPIRED: "expired",
} as const;

export type AdminSubscriptionStatusFilter =
	| PlanStatus
	| (typeof ADMIN_SUBSCRIPTION_STATUS_FILTERS)["EXPIRED"];

export const ADMIN_SUBSCRIPTION_STATUS_FILTER_VALUES = Object.values(
	ADMIN_SUBSCRIPTION_STATUS_FILTERS,
) as [AdminSubscriptionStatusFilter, ...AdminSubscriptionStatusFilter[]];

import { PLAN_STATUS, type PlanStatus } from "./payment-constants";
