// apps/dashboard/src/components/features/subscriptions/subscription-status.tsx
"use client";

import { PLAN_STATUS } from "@rently/db/constants/payment-constants";
import { Badge } from "@rently/ui/components/badge";
import { cn } from "@rently/ui/lib/utils";
import type { SubscriptionWithPlan } from "@rently/validators";

interface SubscriptionStatusProps {
	subscription: SubscriptionWithPlan | null;
	showDetail?: boolean;
	className?: string;
}

// WHY: helper converts a nullable date to days remaining.
// Returns null when date is absent so callers can distinguish "no date" from "0 days".
function daysLeft(date: Date | string | null | undefined): number | null {
	if (!date) return null;
	const ms = new Date(date).getTime() - Date.now();
	return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function shortDate(date: Date | string): string {
	return new Date(date).toLocaleDateString("en-IN", {
		day: "numeric",
		month: "short",
	});
}

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

interface StatusConfig {
	label: string;
	variant: BadgeVariant;
	detail?: string;
}

function getStatusConfig(sub: SubscriptionWithPlan): StatusConfig {
	const { status, trialEndsAt, currentPeriodEnd, plan } = sub;
	const isFree = plan.priceMonthly === 0;

	if (status === PLAN_STATUS.TRIAL) {
		const days = daysLeft(trialEndsAt);
		const expired = days === 0 || days === null;
		return {
			label: expired ? "Trial expired" : `Trial · ${days}d left`,
			variant:
				expired || (days !== null && days <= 3) ? "destructive" : "secondary",
			detail: trialEndsAt ? `Ends ${shortDate(trialEndsAt)}` : undefined,
		};
	}

	if (status === PLAN_STATUS.CANCELLED) {
		return { label: "Cancelled", variant: "destructive" };
	}

	if (status === PLAN_STATUS.PAUSED) {
		return { label: "Paused", variant: "outline" };
	}

	// Active — free tier
	if (isFree) {
		return { label: "Free", variant: "secondary" };
	}

	// Active — paid, check expiry proximity
	if (currentPeriodEnd) {
		const days = daysLeft(currentPeriodEnd);
		if (days !== null && days <= 7) {
			return {
				label: `Expiring in ${days}d`,
				variant: "destructive",
				detail: `Expires ${shortDate(currentPeriodEnd)}`,
			};
		}
		return {
			label: "Active",
			variant: "default",
			detail: `Valid until ${new Date(currentPeriodEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
		};
	}

	// Fallback — active but no period end (e.g. lifetime/beta codes with no expiry set)
	return { label: "Active", variant: "default" };
}

export function SubscriptionStatus({
	subscription,
	showDetail = false,
	className,
}: SubscriptionStatusProps) {
	if (!subscription) {
		return (
			<div className={cn("flex flex-col gap-0.5", className)}>
				<Badge variant="secondary">Free</Badge>
			</div>
		);
	}

	const config = getStatusConfig(subscription);

	return (
		<div className={cn("flex flex-col gap-0.5", className)}>
			<Badge variant={config.variant}>{config.label}</Badge>
			{showDetail && config.detail && (
				<p className="text-[10px] text-muted-foreground">{config.detail}</p>
			)}
		</div>
	);
}
