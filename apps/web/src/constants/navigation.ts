import type { Icon } from "@tabler/icons-react";
import {
	IconBuilding,
	IconFileText,
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
		href: "/properties",
		icon: IconBuilding,
	},
	Tenants: {
		name: "Tenants",
		href: "/tenants",
		icon: IconUsers,
	},
	Leases: {
		name: "Leases",
		href: "/leases",
		icon: IconFileText,
	},
	Payments: {
		name: "Payments",
		href: "/payments",
		icon: IconReceipt,
	},
	Settings: {
		name: "Settings",
		href: "/settings",
		icon: IconSettings,
	},
} as const satisfies Record<string, NavigationLink>;

// ─── Array derived from map — safe, always in sync ────────────
export const NavigationLinks = Object.values(NavigationLinkMap);

// ─── Types derived from data — no manual maintenance ──────────
export type NavigationKey = keyof typeof NavigationLinkMap;
export type NavigationHref = (typeof NavigationLinkMap)[NavigationKey]["href"];
// NavigationHref = "/dashboard" | "/dashboard/properties" | ...
