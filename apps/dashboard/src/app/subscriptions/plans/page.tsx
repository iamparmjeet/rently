// apps/dashboard/src/app/subscriptions/plans/page.tsx
"use client";

import { env } from "@rently/env/web";
import { Button } from "@rently/ui/components/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@rently/ui/components/dialog";
import { Input } from "@rently/ui/components/input";
import { Skeleton } from "@rently/ui/components/skeleton";
import { formatRupees } from "@rently/ui/lib/currency";
import { cn } from "@rently/ui/lib/utils";
import { PageHeader } from "@rently/ui/shared/page-header";
import type { PlanSelect } from "@rently/validators";
import {
	IconArrowLeft,
	IconLoader2,
	IconQrcode,
	IconX,
} from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";
import QRCode from "react-qr-code";
import { PlanCard } from "@/components/features/subscriptions/plan-card";
import { Container } from "@/components/shared/container";
import {
	useListPlans,
	useMySubscription,
	useRedeemBetaCode,
} from "@/hooks/subscriptions";

const SUPPORT_EMAIL =
	env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "info@parmjeetmishra.com";

// ── Types ──

type BillingPeriod = "monthly" | "yearly";

// ── Helpers ─

//  upi:// protocol: standard NPCI deep link — opens in any UPI app
// (GPay, PhonePe, Paytm, BHIM) with amount + note pre-filled.
// UPI ID is embedded in the QR but never shown as plain text.
function buildUpiUrl(
	upiId: string,
	amount: number,
	plan: PlanSelect,
	period: BillingPeriod,
): string {
	const note = encodeURIComponent(`KeyHQ ${plan.name} ${period}`);
	// WHY /100: UPI deep links use rupees, not paise
	const rupees = (amount / 100).toFixed(2);
	return `upi://pay?pa=${upiId}&pn=KeyHQ&am=${rupees}&cu=INR&tn=${note}`;
}

// ── UpgradeDialog ─

interface UpgradeDialogProps {
	plan: PlanSelect;
	open: boolean;
	onClose: () => void;
}

function UpgradeDialog({ plan, open, onClose }: UpgradeDialogProps) {
	const [period, setPeriod] = useState<BillingPeriod>("monthly");
	const [code, setCode] = useState("");
	const redeem = useRedeemBetaCode();

	const upiId = env.NEXT_PUBLIC_UPI_ID;

	const amount = period === "monthly" ? plan.priceMonthly : plan.priceYearly;
	const upiUrl = upiId ? buildUpiUrl(upiId, amount, plan, period) : null;
	const yearlySaving = plan.priceMonthly * 12 - plan.priceYearly;

	function handleRedeem() {
		if (code.length < 4 || redeem.isPending) return;
		redeem.mutate(
			{ code },
			{
				onSuccess: () => {
					onClose();
					setCode("");
				},
			},
		);
	}

	return (
		<Dialog open={open} onOpenChange={(v) => !v && onClose()}>
			<DialogContent
				className="max-h-[90vh] min-w-lg max-w-xl overflow-y-auto p-6"
				showCloseButton={false}
			>
				{/* Header */}
				<div className="mb-5 flex items-start justify-between gap-4">
					<div>
						<DialogTitle className="font-semibold text-base">
							Upgrade to {plan.name}
						</DialogTitle>
						<DialogDescription className="mt-0.5 text-muted-foreground text-xs">
							Pay via UPI · Activate after payment review
						</DialogDescription>
					</div>
					<DialogClose
						render={<Button variant="ghost" size="icon-sm" />}
						onClick={onClose}
					>
						<IconX className="size-4" />
					</DialogClose>
				</div>

				{/* Billing period toggle */}
				<div className="mb-5">
					<p className="mb-2 text-muted-foreground text-xs">
						Select billing period
					</p>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => setPeriod("monthly")}
							className={cn(
								"flex-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
								period === "monthly"
									? "border-primary bg-primary/5"
									: "border-border hover:bg-muted/50",
							)}
						>
							<p className="font-medium text-xs">Monthly</p>
							<p className="font-semibold text-foreground text-sm">
								{formatRupees(plan.priceMonthly)}
								<span className="font-normal text-muted-foreground text-xs">
									{" "}
									/mo
								</span>
							</p>
						</button>

						{plan.priceYearly > 0 && (
							<button
								type="button"
								onClick={() => setPeriod("yearly")}
								className={cn(
									"flex-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
									period === "yearly"
										? "border-primary bg-primary/5"
										: "border-border hover:bg-muted/50",
								)}
							>
								<div className="flex items-center justify-between">
									<p className="font-medium text-xs">Annual</p>
									{yearlySaving > 0 && (
										<span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-[10px] text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
											Save {formatRupees(yearlySaving)}
										</span>
									)}
								</div>
								<p className="font-semibold text-foreground text-sm">
									{formatRupees(plan.priceYearly)}
									<span className="font-normal text-muted-foreground text-xs">
										{" "}
										/yr
									</span>
								</p>
							</button>
						)}
					</div>
				</div>

				{/* QR + Instructions */}
				<div className="mb-5 rounded-xl border bg-muted/30 p-4">
					{upiUrl ? (
						<div className="flex flex-col gap-4 sm:flex-row sm:items-start">
							{/* QR Code — UPI ID is embedded, not shown as text */}
							<div className="flex shrink-0 flex-col items-center gap-1.5">
								<div className="rounded-lg bg-white p-3">
									<QRCode
										value={upiUrl}
										size={150}
										level="M"
										style={{ display: "block" }}
									/>
								</div>
								<p className="text-center text-[10px] text-muted-foreground">
									Scan with any UPI app
								</p>
							</div>

							{/* Instructions */}
							<ol className="flex flex-1 flex-col gap-3 text-xs">
								{[
									<>
										Scan the QR and pay <strong>{formatRupees(amount)}</strong>{" "}
										via GPay, PhonePe, or any UPI app
									</>,
									<>
										Email your <strong>UTR number</strong> to{" "}
										<a
											href={`mailto:${SUPPORT_EMAIL}`}
											className="text-primary underline"
										>
											{SUPPORT_EMAIL}
										</a>
									</>,
									<>
										After the payment is reviewed, you'll receive an{" "}
										<strong>activation code</strong> by email
									</>,
									<>Enter your code below and click Activate</>,
								].map((step, i) => (
									<li key={i} className="flex items-start gap-2">
										<span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-[10px] text-primary">
											{i + 1}
										</span>
										<span>{step}</span>
									</li>
								))}
							</ol>
						</div>
					) : (
						// Fallback: NEXT_PUBLIC_UPI_ID not set
						<div className="flex flex-col items-center gap-2 py-4 text-center">
							<IconQrcode className="size-8 text-muted-foreground" />
							<p className="text-muted-foreground text-xs">
								To upgrade, contact us at{" "}
								<a
									href={`mailto:${SUPPORT_EMAIL}`}
									className="text-primary underline"
								>
									{SUPPORT_EMAIL}
								</a>
							</p>
						</div>
					)}
				</div>

				{/* Activation code input */}
				<div className="space-y-2">
					<p className="font-medium text-xs">Enter activation code</p>
					<div className="flex gap-2">
						<Input
							value={code}
							onChange={(e) => setCode(e.target.value.toUpperCase())}
							placeholder="KEYHQ-XXXX-YYYY"
							className="h-8 font-mono text-xs"
							disabled={redeem.isPending}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleRedeem();
							}}
						/>
						<Button
							size="sm"
							disabled={code.length < 4 || redeem.isPending}
							onClick={handleRedeem}
						>
							{redeem.isPending ? (
								<IconLoader2 className="size-3.5 animate-spin" />
							) : (
								"Activate"
							)}
						</Button>
					</div>
					<p className="text-[10px] text-muted-foreground">
						Already paid? Enter the code you received and click Activate.
					</p>
				</div>
			</DialogContent>
		</Dialog>
	);
}

//  Skeleton
function PlansSkeleton() {
	return (
		<div className="col-span-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
			{[0, 1, 2].map((i) => (
				<Skeleton key={i} className="h-80 w-full rounded-xl" />
			))}
		</div>
	);
}

//  Plans grid
function PlansGrid({
	currentPlanSlug,
	onUpgrade,
	plans,
}: {
	plans: PlanSelect[];
	currentPlanSlug: string;
	onUpgrade: (plan: PlanSelect) => void;
}) {
	return (
		<>
			<div className="col-span-12 grid grid-cols-1 gap-4 pt-4 sm:grid-cols-3">
				{plans.map((plan) => (
					<PlanCard
						key={plan.slug}
						plan={plan}
						isCurrentPlan={plan.slug === currentPlanSlug}
						onUpgrade={onUpgrade}
					/>
				))}
			</div>
			<p className="col-span-12 text-center text-muted-foreground text-xs">
				All plans include all core features. Upgrade or downgrade at any time.{" "}
				<a
					href={`mailto:${SUPPORT_EMAIL}`}
					className="text-primary underline underline-offset-2"
				>
					Questions? Contact us.
				</a>
			</p>
		</>
	);
}

//  Main page

export default function PlansPage() {
	const { data: subscriptionData, isLoading: isSubscriptionLoading } =
		useMySubscription();
	const [upgradePlan, setUpgradePlan] = useState<PlanSelect | null>(null);
	const { data: plansData, isLoading: isPlansLoading } = useListPlans();

	const currentPlanSlug = subscriptionData?.subscription?.plan.slug ?? "free";

	const availablePlans = plansData?.plans ?? [];
	const isLoading = isSubscriptionLoading || isPlansLoading;

	return (
		<Container>
			<div className="col-span-12 flex flex-col gap-6">
				<PageHeader
					title="Plans & Pricing"
					description="Choose the plan that fits your portfolio"
				>
					<Button
						variant="ghost"
						size="sm"
						render={<Link href="/subscriptions" />}
					>
						<IconArrowLeft className="size-3.5" />
						Back
					</Button>
				</PageHeader>

				{isLoading ? (
					<PlansSkeleton />
				) : availablePlans.length === 0 ? (
					<p className="py-12 text-center text-muted-foreground text-sm">
						Plans are temporarily unavailable.
					</p>
				) : (
					<PlansGrid
						plans={availablePlans}
						currentPlanSlug={currentPlanSlug}
						onUpgrade={setUpgradePlan}
					/>
				)}

				{/* WHY rendered outside PlansGrid: upgradePlan state lives here.
				    Passing open + onClose down avoids prop-drilling state setters. */}
				{upgradePlan && (
					<UpgradeDialog
						plan={upgradePlan}
						open={!!upgradePlan}
						onClose={() => setUpgradePlan(null)}
					/>
				)}
			</div>
		</Container>
	);
}
