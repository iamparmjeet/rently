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
	ROOM: "room",
	SHOP: "shop",
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
