import { describe, expect, it } from "vitest";
import { toEditableNotificationPreferences } from "./notification-preferences";

describe("toEditableNotificationPreferences", () => {
	it("removes response metadata before a settings update", () => {
		const updatedAt = new Date("2026-08-07T09:00:00.000Z");
		const response = {
			paymentReceived: true,
			utilityBillGenerated: false,
			leaseExpiryAlert: true,
			rentDueReminder: true,
			overdueAlert: true,
			rentDueLeadDays: 5,
			overdueGraceDays: 4,
			updatedAt,
		};

		expect(toEditableNotificationPreferences(response)).toEqual({
			paymentReceived: true,
			utilityBillGenerated: false,
			leaseExpiryAlert: true,
			rentDueReminder: true,
			overdueAlert: true,
			rentDueLeadDays: 5,
			overdueGraceDays: 4,
		});
	});
});
