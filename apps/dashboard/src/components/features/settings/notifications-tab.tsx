"use client";

// localStorage: notification preferences don't exist in the DB schema yet.
// TODO: migrate to ownerProfiles or a dedicated notificationPreferences table.

import { Button } from "@rently/ui/components/button";
import { Card, CardContent } from "@rently/ui/components/card";
import { Switch } from "@rently/ui/components/switch";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const PREFS_STORAGE_KEY = "rently_notification_prefs";

type NotificationPrefs = {
	rentDueReminders: boolean;
	paymentReceived: boolean;
	leaseExpiryAlerts: boolean;
	utilityBillsGenerated: boolean;
	tenantDocumentUpdates: boolean;
	whatsappRentReminders: boolean;
	whatsappUtilityBills: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
	rentDueReminders: true,
	paymentReceived: true,
	leaseExpiryAlerts: true,
	utilityBillsGenerated: false,
	tenantDocumentUpdates: true,
	whatsappRentReminders: true,
	whatsappUtilityBills: true,
};

const EMAIL_TOGGLES: {
	key: keyof NotificationPrefs;
	label: string;
	description: string;
}[] = [
	{
		key: "rentDueReminders",
		label: "Rent due reminders",
		description: "3 days before, day of, and overdue alerts",
	},
	{
		key: "paymentReceived",
		label: "Payment received",
		description: "Instant notification when rent is paid",
	},
	{
		key: "leaseExpiryAlerts",
		label: "Lease expiry alerts",
		description: "30 days and 7 days before expiry",
	},
	{
		key: "utilityBillsGenerated",
		label: "Utility bills generated",
		description: "When monthly bills are created",
	},
	{
		key: "tenantDocumentUpdates",
		label: "Tenant document updates",
		description: "When tenants upload or update documents",
	},
];

const WHATSAPP_TOGGLES: {
	key: keyof NotificationPrefs;
	label: string;
	description: string;
}[] = [
	{
		key: "whatsappRentReminders",
		label: "Rent reminders via WhatsApp",
		description: "Auto-send payment reminders to tenants",
	},
	{
		key: "whatsappUtilityBills",
		label: "Utility bills via WhatsApp",
		description: "Send bills directly to tenant's WhatsApp",
	},
];

export function NotificationsTab() {
	const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
	const [hasLoaded, setHasLoaded] = useState(false);

	useEffect(() => {
		try {
			const stored = localStorage.getItem(PREFS_STORAGE_KEY);
			if (stored) {
				setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(stored) });
			}
		} catch {
			// Ignore malformed storage — fall back to defaults
		}
		setHasLoaded(true);
	}, []);

	function togglePref(key: keyof NotificationPrefs) {
		setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
	}

	function handleSave() {
		localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
		toast.success("Notification preferences saved");
	}

	if (!hasLoaded) return null;

	return (
		<div className="space-y-4">
			<Card>
				<CardContent className="space-y-4 pt-6">
					<p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
						Email Notifications
					</p>

					<div className="space-y-1 divide-y divide-border">
						{EMAIL_TOGGLES.map(({ key, label, description }) => (
							<div key={key} className="flex items-center justify-between py-3">
								<div>
									<p className="font-medium text-sm">{label}</p>
									<p className="text-muted-foreground text-xs">{description}</p>
								</div>
								<Switch
									checked={prefs[key]}
									onCheckedChange={() => togglePref(key)}
								/>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardContent className="space-y-4 pt-6">
					<p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
						WhatsApp Notifications
					</p>

					<div className="space-y-1 divide-y divide-border">
						{WHATSAPP_TOGGLES.map(({ key, label, description }) => (
							<div key={key} className="flex items-center justify-between py-3">
								<div>
									<p className="font-medium text-sm">{label}</p>
									<p className="text-muted-foreground text-xs">{description}</p>
								</div>
								<Switch
									checked={prefs[key]}
									onCheckedChange={() => togglePref(key)}
								/>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			<Button onClick={handleSave}>Save Preferences</Button>
		</div>
	);
}
