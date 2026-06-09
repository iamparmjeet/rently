import { Badge } from "@rently/ui/components/badge";
import { Button } from "@rently/ui/components/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import { Separator } from "@rently/ui/components/separator";
import { formatRupees } from "@rently/ui/lib/currency";
import { cn } from "@rently/ui/lib/utils";
import type { PlanSelect } from "@rently/validators";
import { IconCheck, IconCrown } from "@tabler/icons-react";

const PLAN_FEATURES: Record<string, readonly string[]> = {
	free: [
		"Up to 10 active tenants",
		"Unlimited properties & units",
		"Lease & payment tracking",
		"Utility billing",
		"Tenant portal",
		"Email notifications",
	],
	pro: [
		"Up to 500 active tenants",
		"Everything in Free",
		"Priority support",
		"Bulk billing operations",
		"Early access to new features",
	],
	enterprise: [
		"Unlimited tenants",
		"Everything in Pro",
		"Custom reports",
		"API access",
		"Dedicated support & SLA",
	],
} as const;

interface PlanCardProps {
	plan: PlanSelect;
	isCurrentPlan: boolean;
	onUpgrade?: (plan: PlanSelect) => void;
	className?: string;
}

export function PlanCard({
	plan,
	isCurrentPlan,
	onUpgrade,
	className,
}: PlanCardProps) {
	const slug = plan.slug ?? "free";
	const features = PLAN_FEATURES[slug] ?? [];

	const isFree = plan.priceMonthly === 0;
	const isPro = slug === "pro";
	const isEnterprise = slug === "enterprise";

	return (
		<Card
			className={cn(
				"relative flex flex-col overflow-visible",
				isPro && "ring-2 ring-primary",
				className,
			)}
		>
			{/* Popular badge — sits above the card border */}
			{isPro && (
				<div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
					<Badge className="gap-1 rounded-sm bg-primary px-3 text-primary-foreground text-xs">
						<IconCrown className="size-3" />
						Most Popular
					</Badge>
				</div>
			)}

			<CardHeader className={cn("border-b", isPro && "pt-7")}>
				<div className="flex items-start justify-between gap-2">
					<CardTitle className="text-sm">{plan.name}</CardTitle>
					{isCurrentPlan && (
						<Badge
							variant="secondary"
							className="shrink-0 rounded-sm text-[10px]"
						>
							Current
						</Badge>
					)}
				</div>

				{/* Description */}
				<p className="text-muted-foreground text-xs">{plan.description}</p>

				{/* Price */}
				<div className="mt-2">
					{isFree ? (
						<p className="font-bold text-2xl">₹0</p>
					) : isEnterprise ? (
						<p className="font-bold text-2xl">Custom</p>
					) : (
						<div className="flex items-baseline gap-1">
							<p className="font-bold text-2xl">
								{formatRupees(plan.priceMonthly)}
							</p>
							<p className="text-muted-foreground text-xs">/month</p>
						</div>
					)}

					{/* Yearly savings */}
					{!isFree &&
						plan.priceYearly > 0 &&
						(() => {
							const yearlySavings = plan.priceMonthly * 12 - plan.priceYearly;
							return yearlySavings > 0 ? (
								<p className="mt-0.5 text-[11px] text-muted-foreground">
									or {formatRupees(plan.priceYearly)}/year{" "}
									<span className="font-medium text-emerald-600 dark:text-emerald-400">
										(save {formatRupees(yearlySavings)})
									</span>
								</p>
							) : null;
						})()}
				</div>
			</CardHeader>

			{/* Features */}
			<CardContent className="flex-1 pt-4">
				<ul className="space-y-2.5">
					{features.map((feature) => (
						<li key={feature} className="flex items-start gap-2 text-xs">
							<IconCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
							<span>{feature}</span>
						</li>
					))}
				</ul>
			</CardContent>

			<Separator />

			{/* CTA */}
			<CardFooter className="pt-4 pb-5">
				{isCurrentPlan ? (
					<Button variant="outline" size="lg" className="w-full" disabled>
						Current Plan
					</Button>
				) : isEnterprise ? (
					<Button
						nativeButton={false}
						variant="outline"
						size="lg"
						className="w-full"
						render={
							<a
								href="mailto:support@rentwise.app"
								target="_blank"
								rel="noreferrer"
								aria-label="Contact Sales via email"
							>
								<p className="sr-only">Contact Sales</p>
							</a>
						}
					>
						Contact Sales
					</Button>
				) : (
					// downgrade label: free plan sits below any paid plan.
					// Calling it "Upgrade to Starter" when the user is on Pro is
					// factually wrong — it's a downgrade.
					<Button
						size="lg"
						className="w-full"
						onClick={() => onUpgrade?.(plan)}
					>
						{isFree ? `Downgrade to ${plan.name}` : `Upgrade to ${plan.name}`}
					</Button>
				)}
			</CardFooter>
		</Card>
	);
}
