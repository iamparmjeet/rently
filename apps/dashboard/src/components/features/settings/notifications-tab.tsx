"use client";

import { Button } from "@rently/ui/components/button";
import { Card, CardContent } from "@rently/ui/components/card";
import { Input } from "@rently/ui/components/input";
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
	rentDueLeadDays: number;
	overdueGraceDays: number;
};

type BooleanPreferenceKey =
	| "paymentReceived"
	| "utilityBillGenerated"
	| "leaseExpiryAlert"
	| "rentDueReminder"
	| "overdueAlert";

const scheduledKeys = new Set<BooleanPreferenceKey>([
	"rentDueReminder",
	"leaseExpiryAlert",
	"overdueAlert",
]);

const fields: Array<{
	key: BooleanPreferenceKey;
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
		description: "Email the tenant before rent is due each month.",
	},
	{
		key: "leaseExpiryAlert",
		label: "Lease expiry alerts",
		description: "Email the tenant 30, 7, and 1 day before lease expiry.",
	},
	{
		key: "overdueAlert",
		label: "Overdue reminders",
		description:
			"Email the tenant once rent remains overdue after the grace period.",
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
		return (
			fields.some(({ key }) => draft[key] !== data.preferences[key]) ||
			draft.rentDueLeadDays !== data.preferences.rentDueLeadDays ||
			draft.overdueGraceDays !== data.preferences.overdueGraceDays
		);
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
						<div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
							<div className="space-y-1.5">
								<label
									className="font-medium text-sm"
									htmlFor="rentDueLeadDays"
								>
									Rent reminder lead time
								</label>
								<p className="text-muted-foreground text-xs">
									Send the rent reminder this many days before the due date
									(0–14).
								</p>
								<Input
									id="rentDueLeadDays"
									type="number"
									min={0}
									max={14}
									value={draft.rentDueLeadDays}
									disabled={update.isPending}
									onChange={(event) =>
										setDraft((current) =>
											current
												? {
														...current,
														rentDueLeadDays: Number(event.target.value),
													}
												: current,
										)
									}
								/>
							</div>
							<div className="space-y-1.5">
								<label
									className="font-medium text-sm"
									htmlFor="overdueGraceDays"
								>
									Overdue reminder grace period
								</label>
								<p className="text-muted-foreground text-xs">
									Send the overdue reminder this many days after the due date
									(1–31).
								</p>
								<Input
									id="overdueGraceDays"
									type="number"
									min={1}
									max={31}
									value={draft.overdueGraceDays}
									disabled={update.isPending}
									onChange={(event) =>
										setDraft((current) =>
											current
												? {
														...current,
														overdueGraceDays: Number(event.target.value),
													}
												: current,
										)
									}
								/>
							</div>
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
						Scheduled reminders run daily at 08:00 IST. Rent reminders are sent
						to tenants only.
					</p>
				)}
			</div>
		</Container>
	);
}
