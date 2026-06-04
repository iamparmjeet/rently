"use client";

import { cn } from "@rently/ui/lib/utils";
import { Suspense, useState } from "react";
import { BillingTab } from "./billing-tab";
import { CurrencyTab } from "./currency-tab";
import { NotificationsTab } from "./notifications-tab";
import { ProfileTab } from "./profile-tab";
import { SecurityTab } from "./security-tab";

// ── Tab definition
// WHY a data structure (not JSX): keeps the tab nav and panel rendering DRY.
// Adding a new tab is one array entry, not changes in two places.
type TabId = "profile" | "security" | "currency" | "notifications" | "billing";

type Tab = {
	id: TabId;
	label: string;
};

const TABS: Tab[] = [
	{ id: "profile", label: "Profile" },
	{ id: "security", label: "Security" },
	{ id: "currency", label: "Currency" },
	{ id: "notifications", label: "Notifications" },
	{ id: "billing", label: "Billing" },
];

// ── Profile tab skeleton — shown while useSuspenseOwnerProfile resolves
function ProfileTabSkeleton() {
	return (
		<div className="space-y-6">
			{[...Array(3)].map((_, i) => (
				<div
					key={i}
					className="space-y-4 rounded-xl border border-border bg-card p-6"
				>
					<div className="h-3 w-32 animate-pulse rounded bg-muted" />
					<div className="grid grid-cols-2 gap-4">
						<div className="h-9 animate-pulse rounded bg-muted" />
						<div className="h-9 animate-pulse rounded bg-muted" />
					</div>
				</div>
			))}
		</div>
	);
}

export function SettingsClient() {
	const [activeTab, setActiveTab] = useState<TabId>("profile");

	return (
		<div className="col-span-12 flex flex-col gap-6">
			{/* ── Page header  */}
			<div>
				<h1 className="font-semibold text-2xl">Settings</h1>
				<p className="mt-0.5 text-muted-foreground text-sm">
					Manage your account and preferences
				</p>
			</div>

			{/* ── Tab navigation ──── */}
			{/* WHY inline tab nav: no Tabs component exists in @rently/ui.
			    Building one here avoids an unnecessary abstraction — the settings
			    page is the only consumer of this nav style. */}
			<div className="border-border border-b">
				<nav className="-mb-px flex flex-wrap gap-0">
					{TABS.map((tab) => (
						<button
							key={tab.id}
							type="button"
							onClick={() => setActiveTab(tab.id)}
							className={cn(
								"whitespace-nowrap border-b-2 px-4 py-2.5 font-medium text-sm transition-colors",
								activeTab === tab.id
									? "border-primary text-primary"
									: "border-transparent text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground",
							)}
						>
							{tab.label}
						</button>
					))}
				</nav>
			</div>

			{/* ── Tab panels ───── */}
			{/* WHY Suspense only around ProfileTab: it's the only tab that
			    issues a network request (useSuspenseOwnerProfile). The others
			    use localStorage or Better Auth client methods synchronously. */}
			{activeTab === "profile" && (
				<Suspense fallback={<ProfileTabSkeleton />}>
					<ProfileTab />
				</Suspense>
			)}
			{activeTab === "security" && <SecurityTab />}
			{activeTab === "currency" && <CurrencyTab />}
			{activeTab === "notifications" && <NotificationsTab />}
			{activeTab === "billing" && <BillingTab />}
		</div>
	);
}
