export const PROPERTY_TYPES = {
  RESIDENTIAL: "residential",
  COMMERCIAL: "commercial",
} as const;

export const PROPERTY_TYPES_VALUES = [
  PROPERTY_TYPES.COMMERCIAL,
  PROPERTY_TYPES.RESIDENTIAL,
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[keyof typeof PROPERTY_TYPES];

//  Units

export const UNIT_TYPES = {
  ROOM: "room",
  SHOP: "shop",
} as const;

export const UNIT_TYPES_VALUES = [UNIT_TYPES.ROOM, UNIT_TYPES.SHOP] as const;

export type UnitType = (typeof UNIT_TYPES)[keyof typeof UNIT_TYPES];

export const UNIT_STATUSES = {
  AVAILABLE: "available",
  OCCUPIED: "occupied",
} as const;

export const UNIT_STATUS_VALUES = [
  UNIT_STATUSES.AVAILABLE,
  UNIT_STATUSES.OCCUPIED,
] as const;

export type UnitStatus = (typeof UNIT_STATUSES)[keyof typeof UNIT_STATUSES];

// ---

export const LEASE_STATUSES = {
  ACTIVE: "active",
  EXPIRED: "expired",
  TERMINATED: "terminated",
} as const;

export const LEASE_STATUS_VALUES = [
  LEASE_STATUSES.ACTIVE,
  LEASE_STATUSES.EXPIRED,
  LEASE_STATUSES.TERMINATED,
] as const;

export type LeaseStatus = (typeof LEASE_STATUSES)[keyof typeof LEASE_STATUSES];

// ---

export const PAYMENT_TYPES = {
  RENT: "rent",
  UTILITY: "utility",
  DEPOSIT: "deposit",
  OTHER: "other",
} as const;

export const PAYMENT_TYPE_VALUES = [
  PAYMENT_TYPES.RENT,
  PAYMENT_TYPES.UTILITY,
  PAYMENT_TYPES.DEPOSIT,
  PAYMENT_TYPES.OTHER,
] as const;

export type PaymentType = (typeof PAYMENT_TYPES)[keyof typeof PAYMENT_TYPES];

// ---

export const UTILITY_TYPES = {
  ELECTRICITY: "electricity",
  WATER: "water",
  MAINTENANCE: "maintenance",
} as const;

export const UTILITY_TYPE_VALUES = [
  UTILITY_TYPES.ELECTRICITY,
  UTILITY_TYPES.WATER,
  UTILITY_TYPES.MAINTENANCE,
] as const;

export type UtilityType = (typeof UTILITY_TYPES)[keyof typeof UTILITY_TYPES];

// ---

export const INVITE_STATUSES = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  EXPIRED: "expired",
} as const;

export const INVITE_STATUS_VALUES = [
  INVITE_STATUSES.PENDING,
  INVITE_STATUSES.ACCEPTED,
  INVITE_STATUSES.EXPIRED,
] as const;

export type InviteStatus =
  (typeof INVITE_STATUSES)[keyof typeof INVITE_STATUSES];
