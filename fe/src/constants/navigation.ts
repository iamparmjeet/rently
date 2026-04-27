import type { Icon } from "@tabler/icons-react";
import {
	IconBuilding,
	IconHome,
	IconReceipt,
	IconSettings,
	IconUsers,
} from "@tabler/icons-react";

interface NavigationLink {
	name: string;
	href: string;
	icon: Icon;
}

export const NavigationLinkMap = {
	Dashboard: {
		name: "Dashboard",
		href: "/dashboard",
		icon: IconHome,
	},
	Properties: {
		name: "Properties",
		href: "/dashboard/properties",
		icon: IconBuilding,
	},
	Tenants: {
		name: "Tenants",
		href: "/dashboard/tenants",
		icon: IconUsers,
	},
	Payments: {
		name: "Payments",
		href: "/dashboard/payments",
		icon: IconReceipt,
	},
	Settings: {
		name: "Settings",
		href: "/dashboard/settings",
		icon: IconSettings,
	},
} as const satisfies Record<string, NavigationLink>;

// ─── Array derived from map — safe, always in sync ────────────
export const NavigationLinks = Object.values(NavigationLinkMap);

// ─── Types derived from data — no manual maintenance ──────────
export type NavigationKey = keyof typeof NavigationLinkMap;
export type NavigationHref = (typeof NavigationLinkMap)[NavigationKey]["href"];
// NavigationHref = "/dashboard" | "/dashboard/properties" | ...
