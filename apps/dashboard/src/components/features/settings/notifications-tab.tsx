"use client";

import { Button } from "@rently/ui/components/button";
import { Card, CardContent } from "@rently/ui/components/card";
import { Switch } from "@rently/ui/components/switch";
import { useEffect, useMemo, useState } from "react";
import { Container } from "@/components/shared/container";
import {
	useNotificationPreferences,
	useUpdateNotificationPreferences,
} from "@/hooks/notifications";

type Preferences = {
	paymentReceived: boolean;
	utilityBillGenerated: boolean;
	leaseExpiryAlert: boolean;
	rentDueReminder: boolean;
	overdueAlert: boolean;
};

const scheduledKeys = new Set<keyof Preferences>([
	"rentDueReminder",
	"leaseExpiryAlert",
	"overdueAlert",
]);

const fields: Array<{
	key: keyof Preferences;
	label: string;
	description: string;
}> = [
	{
		key: "paymentReceived",
		label: "Automatically email payment receipts",
		description: "Email the tenant immediately when a payment is recorded.",
	},
	{
		key: "utilityBillGenerated",
		label: "Automatically email utility bills",
		description: "Email one combined bill when utility charges are generated.",
	},
	{
		key: "rentDueReminder",
		label: "Rent due reminders",
		description:
			"Stored now; scheduled reminders activate in the upcoming milestone.",
	},
	{
		key: "leaseExpiryAlert",
		label: "Lease expiry alerts",
		description:
			"Stored now; scheduled reminders activate in the upcoming milestone.",
	},
	{
		key: "overdueAlert",
		label: "Overdue reminders",
		description:
			"Stored now; scheduled reminders activate in the upcoming milestone.",
	},
];

export function NotificationsTab() {
	const { data, isLoading } = useNotificationPreferences();
	const update = useUpdateNotificationPreferences();
	const [draft, setDraft] = useState<Preferences | null>(null);

	useEffect(() => {
		if (data?.preferences) setDraft(data.preferences);
	}, [data]);

	const changed = useMemo(() => {
		if (!draft || !data?.preferences) return false;
		return fields.some(({ key }) => draft[key] !== data.preferences[key]);
	}, [data?.preferences, draft]);

	if (isLoading || !draft) {
		return (
			<Container className="w-full p-0 sm:max-w-180">
				<p className="text-muted-foreground text-sm">
					Loading notification preferences…
				</p>
			</Container>
		);
	}

	return (
		<Container className="w-full p-0 sm:max-w-180">
			<div className="space-y-4">
				<Card>
					<CardContent className="space-y-4 pt-6">
						<p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
							Email notifications
						</p>
						<div className="space-y-1 divide-y divide-border">
							{fields.map(({ key, label, description }) => (
								<div
									key={key}
									className="flex items-center justify-between gap-4 py-3"
								>
									<div>
										<p className="font-medium text-sm">{label}</p>
										<p className="text-muted-foreground text-xs">
											{description}
										</p>
									</div>
									<Switch
										checked={draft[key]}
										disabled={update.isPending}
										onCheckedChange={(checked) =>
											setDraft((current) =>
												current ? { ...current, [key]: checked } : current,
											)
										}
									/>
								</div>
							))}
						</div>
						<p className="text-muted-foreground text-xs">
							WhatsApp sharing remains manual and opens Web WhatsApp from
							Payment and Utility actions.
						</p>
					</CardContent>
				</Card>
				<Button
					disabled={!changed || update.isPending}
					onClick={() => update.mutate(draft)}
				>
					{update.isPending ? "Saving…" : "Save Preferences"}
				</Button>
				{fields.some(({ key }) => scheduledKeys.has(key)) && (
					<p className="text-muted-foreground text-xs">
						Rent, lease-expiry, and overdue settings are saved for the
						scheduled-reminder milestone and do not send emails yet.
					</p>
				)}
			</div>
		</Container>
	);
}
