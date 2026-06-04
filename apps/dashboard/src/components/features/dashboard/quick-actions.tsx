import type { Icon } from "@tabler/icons-react";
import {
	IconArrowUpRight,
	IconHome2,
	IconKey,
	IconUsers,
} from "@tabler/icons-react";
import Link from "next/link";

interface QuickAction {
	href: string;
	label: string;
	sub: string;
	icon: Icon;
	iconClass: string;
	bgClass: string;
}

const QUICK_ACTIONS = [
	{
		href: "/units/new",
		label: "Add Unit",
		sub: "Create a rentable unit",
		icon: IconHome2,
		iconClass: "text-blue-500",
		bgClass: "bg-blue-500/10",
	},
	{
		href: "/tenants/new",
		label: "Add Tenant",
		sub: "Onboard a new tenant",
		icon: IconUsers,
		iconClass: "text-emerald-500",
		bgClass: "bg-emerald-500/10",
	},
	{
		href: "/leases/new",
		label: "New Lease",
		sub: "Create a lease agreement",
		icon: IconKey,
		iconClass: "text-primary",
		bgClass: "bg-primary/10",
	},
] satisfies QuickAction[];

interface QuickActionsProps {
	className?: string;
}

export function QuickActions({ className = "" }: QuickActionsProps) {
	return (
		<div
			className={`rounded-2xl border border-border/40 bg-card p-6 shadow-sm ${className}`}
		>
			<h3 className="font-semibold text-sm">Quick Actions</h3>

			<div className="mt-4 flex flex-col gap-2">
				{QUICK_ACTIONS.map(
					({ href, label, sub, icon: Icon, iconClass, bgClass }) => (
						<Link
							key={href}
							href={href}
							className="group flex items-center gap-3 rounded-xl border border-border/30 bg-muted/20 p-3 transition-all hover:border-border/60 hover:bg-muted/50"
						>
							<div className={`rounded-lg p-2 transition-colors ${bgClass}`}>
								<Icon className={`size-4 ${iconClass}`} />
							</div>
							<div className="min-w-0 flex-1">
								<p className="font-medium text-sm">{label}</p>
								<p className="truncate text-muted-foreground text-xs">{sub}</p>
							</div>
							<IconArrowUpRight className="size-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-muted-foreground" />
						</Link>
					),
				)}
			</div>
		</div>
	);
}
