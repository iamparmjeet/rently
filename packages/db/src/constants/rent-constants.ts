export const PROPERTY_TYPES = {
	RESIDENTIAL: "residential",
	COMMERCIAL: "commercial",
} as const;

export type PropertyType = (typeof PROPERTY_TYPES)[keyof typeof PROPERTY_TYPES];

export const PROPERTY_TYPES_VALUES = Object.values(PROPERTY_TYPES) as [
	PropertyType,
	...PropertyType[],
];

//  Units

export const UNIT_TYPES = {
	STUDIO: "studio",
	SHOP: "shop",
	ONEBHK: "1BHK",
	TWOBHK: "2BHK",
	THREEBHK: "3BHK",
	FOURBHK: "4BHK",
} as const;

export type UnitType = (typeof UNIT_TYPES)[keyof typeof UNIT_TYPES];

export const UNIT_TYPES_VALUES = Object.values(UNIT_TYPES) as [
	UnitType,
	...UnitType[],
];

export const UNIT_STATUSES = {
	AVAILABLE: "available",
	OCCUPIED: "occupied",
} as const;

export type UnitStatus = (typeof UNIT_STATUSES)[keyof typeof UNIT_STATUSES];

export const UNIT_STATUS_VALUES = Object.values(UNIT_STATUSES) as [
	UnitStatus,
	...UnitStatus[],
];

export const UNIT_FURNISHING = {
	UNFURNISHED: "unfurnished",
	FULLYFURNISHED: "fully_furnished",
	SEMIFURNISHED: "semi_furnished",
} as const;

export type UnitFurnishing =
	(typeof UNIT_FURNISHING)[keyof typeof UNIT_FURNISHING];

export const UNIT_FURNISHING_VALUES = Object.values(UNIT_FURNISHING) as [
	UnitFurnishing,
	...UnitFurnishing[],
];

// ---

export const LEASE_STATUSES = {
	ACTIVE: "active",
	EXPIRED: "expired",
	TERMINATED: "terminated",
} as const;

export type LeaseStatus = (typeof LEASE_STATUSES)[keyof typeof LEASE_STATUSES];

export const LEASE_STATUS_VALUES = Object.values(LEASE_STATUSES) as [
	LeaseStatus,
	...LeaseStatus[],
];

// ---

export const PAYMENT_TYPES = {
	RENT: "rent",
	UTILITY: "utility",
	DEPOSIT: "deposit",
	OTHER: "other",
	REVERSAL: "reversal",
} as const;

export type PaymentType = (typeof PAYMENT_TYPES)[keyof typeof PAYMENT_TYPES];

export const PAYMENT_TYPE_VALUES = Object.values(PAYMENT_TYPES) as [
	PaymentType,
	...PaymentType[],
];

// ---

export const UTILITY_TYPES = {
	ELECTRICITY: "electricity",
	WATER: "water",
	MAINTENANCE: "maintenance",
} as const;

export type UtilityType = (typeof UTILITY_TYPES)[keyof typeof UTILITY_TYPES];

export const UTILITY_TYPE_VALUES = Object.values(UTILITY_TYPES) as [
	UtilityType,
	...UtilityType[],
];

// ---

export const INVITE_STATUSES = {
	PENDING: "pending",
	ACCEPTED: "accepted",
	EXPIRED: "expired",
} as const;

export type InviteStatus =
	(typeof INVITE_STATUSES)[keyof typeof INVITE_STATUSES];

export const INVITE_STATUS_VALUES = Object.values(INVITE_STATUSES) as [
	InviteStatus,
	...InviteStatus[],
];

// ********* Tenant Onboarding ******************

export const TENANT_ONBOARDING_MODES = {
	OWNER_PREPARED: "owner_prepared",
	TENANT_COMPLETED: "tenant_completed",
} as const;

export type TenantOnboardingMode =
	(typeof TENANT_ONBOARDING_MODES)[keyof typeof TENANT_ONBOARDING_MODES];

export const TENANT_ONBOARDING_MODE_VALUES = Object.values(
	TENANT_ONBOARDING_MODES,
) as [TenantOnboardingMode, ...TenantOnboardingMode[]];

// ********* Invitation email delivery state ******************

export const INVITE_DELIVERY_STATUSES = {
	NOT_ATTEMPTED: "not_attempted",
	SENT: "sent",
	FAILED: "failed",
	SUPPRESSED: "suppressed",
} as const;

export type InviteDeliveryStatus =
	(typeof INVITE_DELIVERY_STATUSES)[keyof typeof INVITE_DELIVERY_STATUSES];

export const INVITE_DELIVERY_STATUS_VALUES = Object.values(
	INVITE_DELIVERY_STATUSES,
) as [InviteDeliveryStatus, ...InviteDeliveryStatus[]];

// Safe classifications only. Never persist provider messages or exception text.
export const INVITE_DELIVERY_ERROR_CODES = {
	PROVIDER_REJECTED: "provider_rejected",
	PROVIDER_UNAVAILABLE: "provider_unavailable",
	RATE_LIMITED: "rate_limited",
	UNKNOWN: "unknown",
} as const;

export type InviteDeliveryErrorCode =
	(typeof INVITE_DELIVERY_ERROR_CODES)[keyof typeof INVITE_DELIVERY_ERROR_CODES];

export const INVITE_DELIVERY_ERROR_CODE_VALUES = Object.values(
	INVITE_DELIVERY_ERROR_CODES,
) as [InviteDeliveryErrorCode, ...InviteDeliveryErrorCode[]];
