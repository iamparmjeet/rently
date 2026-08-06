"use client";

import { PLAN_STATUS } from "@rently/db/constants/payment-constants";
import { Button } from "@rently/ui/components/button";
import { Card, CardContent } from "@rently/ui/components/card";
import { Input } from "@rently/ui/components/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@rently/ui/components/table";
import { formatRupees } from "@rently/ui/lib/currency";
import { IconLoader } from "@tabler/icons-react";
import { useState } from "react";
import { Container } from "@/components/shared/container";
import { useMySubscription, useRedeemBetaCode } from "@/hooks/subscriptions";

// ── Sub-components

function BillingTabSkeleton() {
	return (
		<div className="space-y-4">
			<div className="h-40 animate-pulse rounded-xl bg-muted" />
			<div className="h-56 animate-pulse rounded-xl bg-muted" />
		</div>
	);
}

function NoSubscriptionState() {
	return (
		<Container className="w-full p-0 sm:max-w-180">
			<Card>
				<CardContent className="py-10 text-center">
					<p className="text-muted-foreground text-sm">
						No active subscription found. Contact support if this is unexpected.
					</p>
				</CardContent>
			</Card>
		</Container>
	);
}

// ── Beta code redemption inline form
function BetaCodeRedeemer() {
	const [code, setCode] = useState("");
	const redeem = useRedeemBetaCode();

	// console.log("redeem", redeem);

	return (
		<Container className="w-full p-0 sm:max-w-180">
			<div className="flex gap-2 pt-2">
				<Input
					value={code}
					onChange={(e) => setCode(e.target.value.toUpperCase())}
					placeholder="KEYHQ-XXXX-YYYY"
					className="h-9 max-w-48 font-mono text-sm"
					disabled={redeem.isPending}
				/>
				<Button
					size="sm"
					variant="outline"
					disabled={code.length < 4 || redeem.isPending}
					onClick={() => redeem.mutate({ code })}
				>
					{redeem.isPending ? (
						<IconLoader className="size-4 animate-spin" />
					) : (
						"Redeem"
					)}
				</Button>
			</div>
		</Container>
	);
}

// ── Invoice status badge
const STATUS_CLASSES = {
	paid: "bg-green-100 text-green-700",
	unpaid: "bg-yellow-100 text-yellow-700",
	failed: "bg-red-100 text-red-700",
} as const;

// ── Main component ─
export function BillingTab() {
	const { data, isLoading } = useMySubscription();

	if (isLoading) return <BillingTabSkeleton />;
	if (!data?.subscription) return <NoSubscriptionState />;

	const { subscription, invoices } = data;
	const { plan } = subscription;

	const isFree = plan.priceMonthly === 0;
	const isBeta =
		!isFree &&
		subscription.status === PLAN_STATUS.ACTIVE &&
		subscription.currentPeriodEnd !== null;

	return (
		<Container className="w-full p-0 sm:max-w-180">
			<div className="space-y-4">
				{/* ── Active Plan Card ───── */}
				<Card className="overflow-hidden">
					<div className="bg-primary px-6 py-5">
						<div className="flex items-start justify-between">
							<div>
								<p className="font-bold text-primary-foreground text-xl">
									{plan.name}
								</p>
								<p className="mt-0.5 text-primary-foreground/80 text-sm">
									{plan.description}
								</p>
							</div>
							<div className="text-right">
								{isFree ? (
									<p className="font-bold text-3xl text-primary-foreground">
										Free
									</p>
								) : (
									<>
										<p className="font-bold text-3xl text-primary-foreground">
											{formatRupees(plan.priceMonthly)}
										</p>
										<p className="text-primary-foreground/80 text-sm">/month</p>
									</>
								)}
							</div>
						</div>
					</div>

					<CardContent className="space-y-3 pt-5">
						<div className="space-y-2 text-sm">
							{isBeta && subscription.currentPeriodEnd && (
								<div className="flex justify-between">
									<span className="text-muted-foreground">
										Beta access until
									</span>
									<span className="font-medium">
										{new Date(subscription.currentPeriodEnd).toLocaleDateString(
											"en-IN",
											{ day: "numeric", month: "short", year: "numeric" },
										)}
									</span>
								</div>
							)}
							{isFree && (
								<div className="flex justify-between">
									<span className="text-muted-foreground">Tenant limit</span>
									<span className="font-medium">
										{plan.tenantLimit} tenants
									</span>
								</div>
							)}
							<div className="flex justify-between">
								<span className="text-muted-foreground">Status</span>
								<span className="font-medium capitalize">
									{subscription.status}
								</span>
							</div>
						</div>

						{/* ── Actions ────────────────────────────────── */}
						<div className="space-y-2 pt-2">
							{!isBeta && (
								<>
									<p className="text-muted-foreground text-xs">
										Have a beta access code?
									</p>
									<BetaCodeRedeemer />
								</>
							)}
						</div>
					</CardContent>
				</Card>

				{/* ── Billing History ─── */}
				<Card>
					<CardContent className="pt-6">
						<p className="mb-4 font-semibold text-sm">Billing History</p>

						{invoices.length === 0 ? (
							<p className="py-6 text-center text-muted-foreground text-sm">
								No invoices yet.
							</p>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="text-muted-foreground text-xs uppercase">
											Period
										</TableHead>
										<TableHead className="text-muted-foreground text-xs uppercase">
											Amount
										</TableHead>
										<TableHead className="text-muted-foreground text-xs uppercase">
											Status
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{invoices.map((inv) => (
										<TableRow key={inv.id}>
											<TableCell className="text-sm">
												{new Date(inv.periodStart).toLocaleDateString("en-IN", {
													month: "short",
													year: "numeric",
												})}
											</TableCell>
											<TableCell className="text-sm">
												{formatRupees(inv.amount)}
											</TableCell>
											<TableCell>
												<span
													className={`rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_CLASSES[inv.paymentStatus as keyof typeof STATUS_CLASSES] ?? "bg-muted text-muted-foreground"}`}
												>
													{inv.paymentStatus}
												</span>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>
			</div>
		</Container>
	);
}
