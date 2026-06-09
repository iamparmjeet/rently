// Imported via subpath to avoid DB connection side effects on import.
export const NOTIFICATION_TYPES = {
	METER_READING_SUBMITTED: "meter_reading_submitted",
	INVITE_ACCEPTED: "invite_accepted",
	LEASE_EXPIRING_SOON: "lease_expiring_soon",
} as const;

// const tuple (not Object.values): z.enum() requires a non-empty readonly
// tuple — not a plain string[]. Object.values() produces string[].
export const NOTIFICATION_TYPE_VALUES = [
	"meter_reading_submitted",
	"invite_accepted",
	"lease_expiring_soon",
] as const satisfies readonly [string, ...string[]];

export type NotificationType = (typeof NOTIFICATION_TYPE_VALUES)[number];
