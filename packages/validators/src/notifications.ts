import { NOTIFICATION_TYPE_VALUES } from "@rently/db/constants/notification-constants";
import { notifications } from "@rently/db/schema/schema";
import { createSelectSchema } from "drizzle-zod";
import z from "zod";

// Layer 1: DB-derived
export const NotificationSelectSchema = createSelectSchema(notifications);

// Layer 2: API output shape — what the list procedure returns
export const NotificationListItemSchema = z.object({
	id: z.string(),
	type: z.enum(NOTIFICATION_TYPE_VALUES),
	title: z.string(),
	message: z.string(),
	isRead: z.boolean(),
	entityId: z.string().nullable(),
	entityType: z.string().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export type NotificationListItem = z.infer<typeof NotificationListItemSchema>;

export const NotificationPreferencesSchema = z.object({
	paymentReceived: z.boolean(),
	utilityBillGenerated: z.boolean(),
	leaseExpiryAlert: z.boolean(),
	rentDueReminder: z.boolean(),
	overdueAlert: z.boolean(),
	updatedAt: z.date(),
});

export const UpdateNotificationPreferencesSchema = z
	.object({
		paymentReceived: z.boolean(),
		utilityBillGenerated: z.boolean(),
		leaseExpiryAlert: z.boolean(),
		rentDueReminder: z.boolean(),
		overdueAlert: z.boolean(),
	})
	.strict();

export type NotificationPreferences = z.infer<
	typeof NotificationPreferencesSchema
>;
