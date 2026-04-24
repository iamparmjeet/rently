import {
	IconBuilding,
	IconHome,
	IconReceipt,
	IconSettings,
	IconUsers,
} from "@tabler/icons-react";

export const NavigationLinks = [
	{ name: "Dashboard", href: "/dashboard", icon: IconHome },
	{ name: "Properties", href: "/dashboard/properties", icon: IconBuilding },
	{ name: "Tenants", href: "/dashboard/tenants", icon: IconUsers },
	{ name: "Payments", href: "/dashboard/payments", icon: IconReceipt },
	{ name: "Settings", href: "/dashboard/settings", icon: IconSettings },
];

export const NavigationLinkMap = {
	Dashboard: NavigationLinks[0],
	Properties: NavigationLinks[1],
	Tenants: NavigationLinks[2],
	Payments: NavigationLinks[3],
	Settings: NavigationLinks[4],
} as const;

export type NavigationKey = keyof typeof NavigationLinkMap;
