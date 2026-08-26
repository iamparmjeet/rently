"use client";

import { PLAN_STATUS } from "@rently/db/constants/payment-constants";
import { Button } from "@rently/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import { Input } from "@rently/ui/components/input";
import { Skeleton } from "@rently/ui/components/skeleton";
import { formatRupees } from "@rently/ui/lib/currency";
import { PageHeader } from "@rently/ui/shared/page-header";
import {
	IconArrowRight,
	IconLoader2,
	IconReceipt,
	IconShieldCheck,
	IconSparkles,
	IconUsers,
} from "@tabler/icons-react";
import { differenceInDays, format } from "date-fns";
import Link from "next/link";
import { useState } from "react";
import { SubscriptionStatus } from "@/components/features/subscriptions/subscription-status";
import { Container } from "@/components/shared/container";
import { useMySubscription, useRedeemBetaCode } from "@/hooks/subscriptions";
import { useMounted } from "@/hooks/use-mounted";

// ── Loading skeleton
function SubscriptionPageSkeleton() {
	return (
		<div className="col-span-12 space-y-4">
			<Skeleton className="h-28 w-full rounded-xl" />
			<Skeleton className="h-40 w-full rounded-xl" />
		</div>
	);
}

// ── Beta code redemption form
function BetaCodeRedeemer() {
	const [code, setCode] = useState("");
	const redeem = useRedeemBetaCode();

	return (
		<div className="flex gap-2">
			<Input
				value={code}
				onChange={(e) => setCode(e.target.value.toUpperCase())}
				placeholder="KEYHQ-XXXX-YYYY"
				className="h-8 max-w-52 font-mono text-xs"
				disabled={redeem.isPending}
				onKeyDown={(e) => {
					if (e.key === "Enter" && code.length >= 4 && !redeem.isPending) {
						redeem.mutate({ code });
					}
				}}
			/>
			<Button
				size="sm"
				variant="outline"
				disabled={code.length < 4 || redeem.isPending}
				onClick={() => redeem.mutate({ code })}
			>
				{redeem.isPending ? (
					<IconLoader2 className="size-3.5 animate-spin" />
				) : (
					"Activate"
				)}
			</Button>
		</div>
	);
}

// ── Main page
export default function SubscriptionsPage() {
	const mounted = useMounted();
	const { data, isLoading } = useMySubscription();

	if (isLoading) {
		return (
			<Container>
				<div className="col-span-12 space-y-6">
					<PageHeader title="Subscription" />
					<SubscriptionPageSkeleton />
				</div>
			</Container>
		);
	}

	const subscription = data?.subscription ?? null;
	const plan = subscription?.plan;

	const isFree = !plan || plan.priceMonthly === 0;
	const isOnBeta =
		!isFree &&
		subscription?.status === PLAN_STATUS.ACTIVE &&
		subscription.currentPeriodEnd !== null;
	const isOnTrial = subscription?.status === PLAN_STATUS.TRIAL;

	// Days left — used in the plan card details
	const expiryDate =
		subscription?.trialEndsAt ?? subscription?.currentPeriodEnd;
	const daysRemaining =
		mounted && expiryDate
			? differenceInDays(new Date(expiryDate), new Date())
			: null;

	return (
		<Container>
			<div className="col-span-12 flex flex-col gap-6">
				{/* Header */}
				<PageHeader title="Subscription">
					<SubscriptionStatus subscription={subscription} />
				</PageHeader>

				<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
					{/*  Current Plan Card  */}
					<div className="lg:col-span-2">
						<Card>
							<CardHeader className="border-b">
								<CardTitle className="text-sm">Current Plan</CardTitle>
							</CardHeader>

							<CardContent className="space-y-4 pt-5">
								{/* Plan header */}
								<div className="flex items-start justify-between">
									<div>
										<p className="font-semibold text-lg">
											{plan?.name ?? "Free"}
										</p>
										<p className="text-muted-foreground text-xs">
											{plan?.description ?? "Free forever · Limited tenants"}
										</p>
									</div>
									{plan && plan.priceMonthly > 0 && (
										<div className="text-right">
											<p className="font-bold text-xl">
												{formatRupees(plan.priceMonthly)}
											</p>
											<p className="text-muted-foreground text-xs">/month</p>
										</div>
									)}
								</div>

								{/* Plan stats row */}
								<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
									<div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
										<IconUsers className="size-4 text-muted-foreground" />
										<div>
											<p className="font-medium text-xs">
												{plan?.tenantLimit ?? 10}
											</p>
											<p className="text-[10px] text-muted-foreground">
												Tenant limit
											</p>
										</div>
									</div>

									<div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
										<IconShieldCheck className="size-4 text-muted-foreground" />
										<div>
											<p className="font-medium text-xs capitalize">
												{subscription?.status ?? "free"}
											</p>
											<p className="text-[10px] text-muted-foreground">
												Status
											</p>
										</div>
									</div>

									{mounted && daysRemaining !== null && (
										<div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
											<IconSparkles className="size-4 text-muted-foreground" />
											<div>
												<p
													className="font-medium text-xs"
													suppressHydrationWarning
												>
													{daysRemaining > 0 ? `${daysRemaining}d` : "Expired"}
												</p>
												<p className="text-[10px] text-muted-foreground">
													{isOnBeta ? "Access left" : "Trial left"}
												</p>
											</div>
										</div>
									)}

									{mounted && expiryDate && !isOnTrial && (
										<div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
											<IconSparkles className="size-4 text-muted-foreground" />
											<div>
												<p
													className="font-medium text-xs"
													suppressHydrationWarning
												>
													{format(new Date(expiryDate), "d MMM yyyy")}
												</p>
												<p className="text-[10px] text-muted-foreground">
													Access until
												</p>
											</div>
										</div>
									)}
								</div>

								{/* Upgrade CTA for free/trial users */}
								{(isFree || isOnTrial) && (
									<div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
										<p className="font-medium text-sm">Upgrade to Pro</p>
										<p className="mt-0.5 text-muted-foreground text-xs">
											Manage up to 500 tenants, priority support, and more for{" "}
											<span className="font-medium text-foreground">
												₹499/month
											</span>
										</p>
										<Button
											nativeButton={false}
											size="sm"
											className="mt-3"
											render={<Link href="/subscriptions/plans" />}
										>
											View Plans
											<IconArrowRight className="ml-1 size-3.5" />
										</Button>
									</div>
								)}
							</CardContent>
						</Card>
					</div>

					{/* ── Right column: actions ─── */}
					<div className="flex flex-col gap-4">
						{/* Beta code redemption — always visible unless already on paid active plan with no expiry concern */}
						<Card>
							<CardHeader className="border-b pb-3">
								<CardTitle className="text-sm">Activate Code</CardTitle>
							</CardHeader>
							<CardContent className="space-y-2 pt-4">
								<p className="text-muted-foreground text-xs">
									Have a beta access code? Enter it below to upgrade your plan.
								</p>
								<BetaCodeRedeemer />
							</CardContent>
						</Card>

						{/* Billing history shortcut */}
						<Card>
							<CardContent className="py-4">
								<Button
									nativeButton={false}
									variant="ghost"
									className="flex w-full items-center justify-between"
									render={<Link href="/subscriptions/billing" />}
								>
									<div className="flex items-center gap-2">
										<IconReceipt className="size-4 text-muted-foreground" />
										<span className="text-xs">Billing History</span>
									</div>
									<IconArrowRight className="size-3.5 text-muted-foreground" />
								</Button>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</Container>
	);
}
