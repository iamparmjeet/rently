export type EditableNotificationPreferences = {
	paymentReceived: boolean;
	utilityBillGenerated: boolean;
	leaseExpiryAlert: boolean;
	rentDueReminder: boolean;
	overdueAlert: boolean;
	rentDueLeadDays: number;
	overdueGraceDays: number;
};

type NotificationPreferencesResponse = EditableNotificationPreferences & {
	updatedAt: Date;
};

export function toEditableNotificationPreferences(
	preferences: NotificationPreferencesResponse,
): EditableNotificationPreferences {
	return {
		paymentReceived: preferences.paymentReceived,
		utilityBillGenerated: preferences.utilityBillGenerated,
		leaseExpiryAlert: preferences.leaseExpiryAlert,
		rentDueReminder: preferences.rentDueReminder,
		overdueAlert: preferences.overdueAlert,
		rentDueLeadDays: preferences.rentDueLeadDays,
		overdueGraceDays: preferences.overdueGraceDays,
	};
}
