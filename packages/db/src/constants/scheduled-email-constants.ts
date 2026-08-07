export const SCHEDULED_EMAIL_TYPES = {
	LEASE_EXPIRY: "lease_expiry",
	RENT_DUE: "rent_due",
	OVERDUE: "overdue",
} as const;

export type ScheduledEmailType =
	(typeof SCHEDULED_EMAIL_TYPES)[keyof typeof SCHEDULED_EMAIL_TYPES];

export const SCHEDULED_EMAIL_TYPE_VALUES = Object.values(
	SCHEDULED_EMAIL_TYPES,
) as [ScheduledEmailType, ...ScheduledEmailType[]];

export const SCHEDULED_EMAIL_DELIVERY_STATUSES = {
	CLAIMED: "claimed",
	SENT: "sent",
	FAILED: "failed",
} as const;

export type ScheduledEmailDeliveryStatus =
	(typeof SCHEDULED_EMAIL_DELIVERY_STATUSES)[keyof typeof SCHEDULED_EMAIL_DELIVERY_STATUSES];

export const SCHEDULED_EMAIL_DELIVERY_STATUS_VALUES = Object.values(
	SCHEDULED_EMAIL_DELIVERY_STATUSES,
) as [ScheduledEmailDeliveryStatus, ...ScheduledEmailDeliveryStatus[]];
