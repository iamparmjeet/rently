"use client";

import { cn } from "@rently/ui/lib/utils";
import {
	IconBolt,
	IconCurrencyRupee,
	IconLayoutDashboard,
	IconReceipt2,
	IconUser,
} from "@tabler/icons-react";
import type { TenantPortalTab } from "../features/tenant/tenant-dashboard";

interface NavItem {
	id: TenantPortalTab;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
	{ id: "overview", label: "Overview", icon: IconLayoutDashboard },
	{ id: "bill", label: "My Bill", icon: IconReceipt2 },
	{ id: "reading", label: "Reading", icon: IconBolt },
	{ id: "payments", label: "Payments", icon: IconCurrencyRupee },
	{ id: "docs", label: "Profile", icon: IconUser },
];

interface BottomNavProps {
	activeTab: TenantPortalTab;
	onTabChange: (tab: TenantPortalTab) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
	return (
		<nav className="fixed right-0 bottom-0 left-0 z-50 mx-auto flex max-w-220 border-t bg-background">
			{NAV_ITEMS.map(({ id, label, icon: Icon }) => {
				const isActive = activeTab === id;
				return (
					<button
						key={id}
						type="button"
						onClick={() => onTabChange(id)}
						className={cn(
							"flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 py-2.5 font-medium text-[10.5px] transition-colors",
							"border-t-2",
							isActive
								? "border-primary text-primary"
								: "border-transparent text-muted-foreground hover:text-foreground",
						)}
					>
						<Icon className="h-5 w-5" />
						{label}
					</button>
				);
			})}
		</nav>
	);
}
