import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import {
	IconArrowUpRight,
	IconHome2,
	IconKey,
	IconUsers,
} from "@tabler/icons-react";
import Link from "next/link";
import type { ComponentType } from "react";

interface QuickAction {
	href: string;
	label: string;
	sub: string;
	icon: ComponentType<{ className?: string }>;
	iconClass: string;
	bgClass: string;
}

const QUICK_ACTIONS: QuickAction[] = [
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
] as const;

interface QuickActionsProps {
	className?: string;
}

export function QuickActions({ className }: QuickActionsProps) {
	return (
		<Card
			className={`rounded-2xl border border-border/40 bg-card p-6 shadow-sm ${className}`}
		>
			<CardHeader>
				<CardTitle className="font-semibold text-sm">Quick Actions</CardTitle>
			</CardHeader>

			<CardContent className="space-y-1.5 px-3 pb-3">
				{QUICK_ACTIONS.map((action) => (
					<Link
						key={action.href}
						href={action.href}
						className="group flex items-center gap-3 rounded-xl border border-border/30 bg-muted/20 p-3 transition-all hover:border-border/60 hover:bg-muted/50"
					>
						<div
							className={`rounded-lg p-2 transition-colors ${action.bgClass}`}
						>
							<action.icon className={`size-4 ${action.iconClass}`} />
						</div>
						<div className="min-w-0 flex-1">
							<p className="font-medium text-sm">{action.label}</p>
							<p className="truncate text-muted-foreground text-xs">
								{action.sub}
							</p>
						</div>
						<IconArrowUpRight className="size-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-muted-foreground" />
					</Link>
				))}
			</CardContent>
		</Card>
	);
}
