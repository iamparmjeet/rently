import { ownerProcedure } from "@rently/api/procedures";
import type { NotificationType } from "@rently/db/constants/notification-constants";
import { NOTIFICATION_TYPES } from "@rently/db/constants/notification-constants";
import {
	leases,
	notificationPreferences,
	notifications,
	properties,
	units,
} from "@rently/db/schema/schema";
import {
	NotificationListItemSchema,
	NotificationPreferencesSchema,
	UpdateNotificationPreferencesSchema,
} from "@rently/validators";
import { and, count, desc, eq, gte, inArray, lte } from "drizzle-orm";
import z from "zod";

const notificationPreferencesOutput = z.object({
	preferences: NotificationPreferencesSchema,
});

const preferenceValues = (
	input: z.infer<typeof UpdateNotificationPreferencesSchema>,
) => ({
	paymentReceived: input.paymentReceived,
	utilityBillGenerated: input.utilityBillGenerated,
	leaseExpiryAlert: input.leaseExpiryAlert,
	rentDueReminder: input.rentDueReminder,
	overdueAlert: input.overdueAlert,
});

export const getPreferences = ownerProcedure
	.route({ method: "GET", path: "/notification/preferences" })
	.output(notificationPreferencesOutput)
	.handler(async ({ context }) => {
		const { db, user } = context;
		await db
			.insert(notificationPreferences)
			.values({ ownerId: user.id })
			.onConflictDoNothing({ target: notificationPreferences.ownerId });
		const [preferences] = await db
			.select({
				paymentReceived: notificationPreferences.paymentReceived,
				utilityBillGenerated: notificationPreferences.utilityBillGenerated,
				leaseExpiryAlert: notificationPreferences.leaseExpiryAlert,
				rentDueReminder: notificationPreferences.rentDueReminder,
				overdueAlert: notificationPreferences.overdueAlert,
				updatedAt: notificationPreferences.updatedAt,
			})
			.from(notificationPreferences)
			.where(eq(notificationPreferences.ownerId, user.id));
		if (!preferences)
			throw new Error("Notification preferences could not be loaded");
		return { preferences };
	});

export const updatePreferences = ownerProcedure
	.route({ method: "PATCH", path: "/notification/preferences" })
	.input(UpdateNotificationPreferencesSchema)
	.output(notificationPreferencesOutput)
	.handler(async ({ context, input }) => {
		const { db, user } = context;
		const values = preferenceValues(input);
		await db
			.insert(notificationPreferences)
			.values({ ownerId: user.id, ...values })
			.onConflictDoUpdate({
				target: notificationPreferences.ownerId,
				set: { ...values, updatedAt: new Date() },
			});
		const [preferences] = await db
			.select({
				paymentReceived: notificationPreferences.paymentReceived,
				utilityBillGenerated: notificationPreferences.utilityBillGenerated,
				leaseExpiryAlert: notificationPreferences.leaseExpiryAlert,
				rentDueReminder: notificationPreferences.rentDueReminder,
				overdueAlert: notificationPreferences.overdueAlert,
				updatedAt: notificationPreferences.updatedAt,
			})
			.from(notificationPreferences)
			.where(eq(notificationPreferences.ownerId, user.id));
		if (!preferences)
			throw new Error("Notification preferences could not be saved");
		return { preferences };
	});

//  1. List notifications
// WHY this procedure does writes on a GET: lease-expiry notifications are
// lazily created here rather than via a cron. The alternative (a scheduled job)
// requires Cloudflare Cron Triggers — unnecessary complexity at this scale.
// The cost is two extra queries per poll cycle (tiny at <50 leases per owner).
export const listNotifications = ownerProcedure
	.route({ method: "GET", path: "/notification/list" })
	.output(z.object({ notifications: z.array(NotificationListItemSchema) }))
	.handler(async ({ context }) => {
		const { db, user } = context;

		//  Lazy-create lease expiry notifications
		const now = new Date();
		const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

		const expiringLeases = await db
			.select({
				id: leases.id,
				endDate: leases.endDate,
				unitNumber: units.unitNumber,
			})
			.from(leases)
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.where(
				and(
					eq(properties.ownerId, user.id),
					eq(leases.status, "active"),
					gte(leases.endDate, now), // not already expired
					lte(leases.endDate, thirtyDaysOut), // expiring within 30 days
				),
			);

		if (expiringLeases.length > 0) {
			// Find which ones already have an unread notification — avoid duplicates
			const existing = await db
				.select({ entityId: notifications.entityId })
				.from(notifications)
				.where(
					and(
						eq(notifications.userId, user.id),
						eq(notifications.type, NOTIFICATION_TYPES.LEASE_EXPIRING_SOON),
						eq(notifications.isRead, false),
						inArray(
							notifications.entityId,
							expiringLeases.map((l) => l.id),
						),
					),
				);

			const alreadyNotified = new Set(existing.map((n) => n.entityId));

			const toInsert = expiringLeases
				.filter((l) => !alreadyNotified.has(l.id))
				// SQL filters imply endDate is non-null, but Drizzle types don't know that.
				// This filter narrows the type so the .map() below has Date, not Date | null.
				.filter((l): l is typeof l & { endDate: Date } => l.endDate !== null);

			if (toInsert.length > 0) {
				await db.insert(notifications).values(
					toInsert.map((lease) => {
						const daysLeft = Math.ceil(
							(lease.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
						);
						return {
							userId: user.id,
							type: NOTIFICATION_TYPES.LEASE_EXPIRING_SOON as NotificationType,
							title: "Lease expiring soon",
							message: `Lease for Unit ${lease.unitNumber} expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
							entityId: lease.id,
							entityType: "lease",
						};
					}),
				);
			}
		}

		//  Fetch all notifications, newest first
		const results = await db
			.select({
				id: notifications.id,
				type: notifications.type,
				title: notifications.title,
				message: notifications.message,
				isRead: notifications.isRead,
				entityId: notifications.entityId,
				entityType: notifications.entityType,
				createdAt: notifications.createdAt,
				updatedAt: notifications.updatedAt,
			})
			.from(notifications)
			.where(eq(notifications.userId, user.id))
			.orderBy(desc(notifications.createdAt))
			.limit(50);

		return { notifications: results };
	});

//  2. Unread count
// WHY separate procedure: the header bell badge polls this on a 30s interval.
// Keeping it cheap (COUNT only, no JOINs) matters for polling performance.
export const getUnreadCount = ownerProcedure
	.route({ method: "GET", path: "/notification/unread-count" })
	.output(z.object({ count: z.number().int() }))
	.handler(async ({ context }) => {
		const { db, user } = context;

		const [result] = await db
			.select({ count: count() })
			.from(notifications)
			.where(
				and(eq(notifications.userId, user.id), eq(notifications.isRead, false)),
			);

		return { count: result?.count ?? 0 };
	});

//  3. Mark one as read ─
export const markAsRead = ownerProcedure
	.route({ method: "PATCH", path: "/notification/read" })
	.input(z.object({ id: z.string().min(1) }))
	.output(z.object({ success: z.boolean() }))
	.handler(async ({ context, input }) => {
		const { db, user } = context;

		// SECURITY: userId filter prevents marking another owner's notification
		await db
			.update(notifications)
			.set({ isRead: true, updatedAt: new Date() })
			.where(
				and(eq(notifications.id, input.id), eq(notifications.userId, user.id)),
			);

		return { success: true };
	});

//  4. Mark all as read ─
export const markAllAsRead = ownerProcedure
	.route({ method: "PATCH", path: "/notification/read-all" })
	.output(z.object({ success: z.boolean() }))
	.handler(async ({ context }) => {
		const { db, user } = context;

		await db
			.update(notifications)
			.set({ isRead: true, updatedAt: new Date() })
			.where(
				and(eq(notifications.userId, user.id), eq(notifications.isRead, false)),
			);

		return { success: true };
	});
