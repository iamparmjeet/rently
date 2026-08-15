import {
	IconActivity,
	IconCreditCard,
	IconKey,
	IconLayoutDashboard,
	IconUsers,
} from "@tabler/icons-react";

export const ADMIN_NAVIGATION = [
	{ name: "Overview", href: "/dashboard", icon: IconLayoutDashboard },
	{ name: "Users", href: "/users", icon: IconUsers },
	{ name: "Subscriptions", href: "/subscriptions", icon: IconCreditCard },
	{ name: "Beta codes", href: "/beta-codes", icon: IconKey },
	{ name: "Audit log", href: "/audit-log", icon: IconActivity },
] as const;
