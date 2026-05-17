import type { Icon } from "@tabler/icons-react";
import {
	IconBolt,
	IconBuilding,
	IconDoor,
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
	Units: {
		name: "Units",
		href: "/units",
		icon: IconDoor,
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
	Utilities: {
		name: "Utilities",
		href: "/utilities",
		icon: IconBolt,
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
export type NavigationHrefT = (typeof NavigationLinkMap)[NavigationKey]["href"];
// NavigationHref = "/dashboard" | "/dashboard/properties" | ...

const PROTECTED_KEYS = [
	"Dashboard",
	"Properties",
	"Tenants",
	"Leases",
	"Payments",
	"Settings",
] as const satisfies readonly NavigationKey[];

const PROTECTED_NAV_ROUTES = PROTECTED_KEYS.map(
	(key) => NavigationLinkMap[key].href,
);

// Non-navigation routes that still need protection (sub-pages, APIs, etc.)
const EXTRA_PROTECTED_ROUTES = [
	"/units",
	"/utilities",
	"/subscriptions",
] as const;

export const PROTECTED_ROUTES = [
	...PROTECTED_NAV_ROUTES,
	...EXTRA_PROTECTED_ROUTES,
] as const;

// Auth routes (login/register) — kept here for colocation
export const AUTH_ROUTES = ["/login", "/register"] as const;
