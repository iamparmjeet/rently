"use client";

import { Container } from "@/components/shared/container";
//  placeholder data: the subscriptions router is still legacy Hono style —
// not yet migrated to oRPC. This tab shows the correct UI shape with mock data
// so the page is complete. TODO: wire orpc.subscriptions.* when migrated.

import { Button } from "@rently/ui/components/button";
import { Card, CardContent } from "@rently/ui/components/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@rently/ui/components/table";
import { IconCreditCard } from "@tabler/icons-react";

// ── Types — will be replaced with z.infer<> from validators once subscription
// oRPC migration is complete ─
type BillingRecord = {
	id: string;
	date: string;
	plan: string;
	amount: number; // paise
	status: "paid" | "pending" | "failed";
};

// ── Mock data — replace with useSuspenseSubscription() after oRPC migration ──
const MOCK_PLAN = {
	name: "Pro Plan",
	description: "Unlimited properties · Priority support",
	priceMonthly: 49900, // paise — ₹499
	nextBillingDate: "Jun 15, 2026",
	paymentMethod: "Visa •••• 4242",
	memberSince: "Jan 2025",
};

const MOCK_BILLING_HISTORY: BillingRecord[] = [
	{
		id: "1",
		date: "May 15, 2026",
		plan: "Pro Plan",
		amount: 49900,
		status: "paid",
	},
	{
		id: "2",
		date: "Apr 15, 2026",
		plan: "Pro Plan",
		amount: 49900,
		status: "paid",
	},
	{
		id: "3",
		date: "Mar 15, 2026",
		plan: "Pro Plan",
		amount: 49900,
		status: "paid",
	},
];

// ── Paise → rupees display ────
// WHY here and not globally: this is a display-only utility.
// The canonical anti-corruption layer lives at the form boundary.
function formatRupees(paise: number): string {
	return `₹${(paise / 100).toFixed(0)}`;
}

const STATUS_STYLES: Record<BillingRecord["status"], string> = {
	paid: "bg-green-100 text-green-700",
	pending: "bg-yellow-100 text-yellow-700",
	failed: "bg-red-100 text-red-700",
};

export function BillingTab() {
	return (
		<Container className="w-full p-0 sm:max-w-180">
			<div className="space-y-4">
				{/* ── Active Plan ──────── */}
				<Card className="overflow-hidden">
					{/* Blue header — matches mockup's gradient plan card */}
					<div className="bg-primary px-6 py-5">
						<div className="flex items-start justify-between">
							<div>
								<p className="font-bold text-primary-foreground text-xl">
									{MOCK_PLAN.name}
								</p>
								<p className="mt-0.5 text-primary-foreground/80 text-sm">
									{MOCK_PLAN.description}
								</p>
							</div>
							<div className="text-right">
								<p className="font-bold text-3xl text-primary-foreground">
									{formatRupees(MOCK_PLAN.priceMonthly)}
								</p>
								<p className="text-primary-foreground/80 text-sm">/month</p>
							</div>
						</div>
					</div>

					<CardContent className="space-y-3 pt-5">
						{/* Billing details grid */}
						<div className="space-y-2 text-sm">
							<div className="flex justify-between">
								<span className="text-muted-foreground">Next billing date</span>
								<span className="font-medium">{MOCK_PLAN.nextBillingDate}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Payment method</span>
								<span className="flex items-center gap-1.5 font-medium">
									<IconCreditCard className="size-4 text-muted-foreground" />
									{MOCK_PLAN.paymentMethod}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Member since</span>
								<span className="font-medium">{MOCK_PLAN.memberSince}</span>
							</div>
						</div>

						{/* Plan actions */}
						<div className="flex gap-2 pt-2">
							<Button
								variant="outline"
								size="sm"
								// TODO: wire to payment method update flow
								onClick={() => {}}
							>
								Update Payment Method
							</Button>
							<Button
								variant="ghost"
								size="sm"
								className="text-destructive hover:bg-destructive/10 hover:text-destructive"
								// TODO: wire to subscription cancellation flow with confirmation dialog
								onClick={() => {}}
							>
								Cancel Plan
							</Button>
						</div>
					</CardContent>
				</Card>

				{/* ── Billing History ──── */}
				<Card>
					<CardContent className="pt-6">
						<p className="mb-4 font-semibold text-sm">Billing History</p>

						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="text-muted-foreground text-xs uppercase">
										Date
									</TableHead>
									<TableHead className="text-muted-foreground text-xs uppercase">
										Plan
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
								{MOCK_BILLING_HISTORY.map((record) => (
									<TableRow key={record.id}>
										<TableCell className="text-sm">{record.date}</TableCell>
										<TableCell className="text-sm">{record.plan}</TableCell>
										<TableCell className="font-medium text-sm">
											{formatRupees(record.amount)}
										</TableCell>
										<TableCell>
											<span
												className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium text-xs ${STATUS_STYLES[record.status]}`}
											>
												<span className="size-1.5 rounded-full bg-current" />
												{record.status.charAt(0).toUpperCase() +
													record.status.slice(1)}
											</span>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			</div>
		</Container>
	);
}
