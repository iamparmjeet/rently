"use client";

import {
	ADMIN_SUBSCRIPTION_STATUS_FILTER_VALUES,
	type AdminSubscriptionStatusFilter,
} from "@rently/db/constants/admin-constants";
import {
	BILLING_INTERVAL,
	BILLING_INTERVAL_VALUES,
	type BillingInterval,
	PAYMENT_METHOD_VALUES,
	PAYMENT_METHODS,
	type PaymentMethod,
} from "@rently/db/constants/payment-constants";
import { Button } from "@rently/ui/components/button";
import { Card, CardContent } from "@rently/ui/components/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@rently/ui/components/dialog";
import { Input } from "@rently/ui/components/input";
import { Label } from "@rently/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@rently/ui/components/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@rently/ui/components/table";
import { Textarea } from "@rently/ui/components/textarea";
import { PageHeader } from "@rently/ui/shared/page-header";
import type {
	AdminSubscriptionListResponse,
	PlanSelect,
} from "@rently/validators";
import { useMemo, useState } from "react";
import { Container } from "@/components/shared/container";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import {
	useAdminSubscriptions,
	usePlans,
	useRecordSubscriptionPayment,
} from "@/hooks/admin";
import { formatDate, formatMoney } from "@/utils/format";

type SubscriptionRow = AdminSubscriptionListResponse["items"][number];

const INTERVAL_LABELS: Record<BillingInterval, string> = {
	monthly: "Monthly",
	quarterly: "Quarterly",
	halfyear: "Half-yearly",
	year: "Yearly",
	twoyear: "Two years",
};

const METHOD_LABELS: Record<PaymentMethod, string> = {
	upi: "UPI",
	bank_transfer: "Bank transfer",
	online: "Online",
	cash: "Cash",
	cheque: "Cheque",
};

function planPrice(plan: PlanSelect, interval: BillingInterval): number {
	switch (interval) {
		case BILLING_INTERVAL.MONTHLY:
			return plan.priceMonthly;
		case BILLING_INTERVAL.QUARTERLY:
			return plan.priceQuarterly;
		case BILLING_INTERVAL.HALFYEAR:
			return plan.priceHalfYearly;
		case BILLING_INTERVAL.YEAR:
			return plan.priceYearly;
		case BILLING_INTERVAL.TWOYEAR:
			return plan.priceTwoYear;
	}
}

function currentLocalDateTime(): string {
	const date = new Date();
	date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
	return date.toISOString().slice(0, 16);
}

function RecordPaymentDialog({
	owner,
	plans,
	open,
	onOpenChange,
}: {
	owner: SubscriptionRow | null;
	plans: PlanSelect[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const recordPayment = useRecordSubscriptionPayment();
	const [planId, setPlanId] = useState("");
	const [interval, setInterval] = useState<BillingInterval>(
		BILLING_INTERVAL.MONTHLY,
	);
	const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
		PAYMENT_METHODS.UPI,
	);
	const [reference, setReference] = useState("");
	const [paidAt, setPaidAt] = useState(currentLocalDateTime);
	const [reason, setReason] = useState("");

	const selectedPlan = useMemo(
		() => plans.find((plan) => plan.id === planId),
		[planId, plans],
	);
	const amount = selectedPlan ? planPrice(selectedPlan, interval) : 0;

	function reset() {
		setPlanId("");
		setInterval(BILLING_INTERVAL.MONTHLY);
		setPaymentMethod(PAYMENT_METHODS.UPI);
		setReference("");
		setPaidAt(currentLocalDateTime());
		setReason("");
	}

	function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!owner || !selectedPlan) return;

		recordPayment.mutate(
			{
				ownerUserId: owner.ownerId,
				planId: selectedPlan.id,
				billingInterval: interval,
				amount,
				paymentMethod,
				externalPaymentReference: reference,
				paidAt: new Date(paidAt),
				reason,
			},
			{
				onSuccess: () => {
					reset();
					onOpenChange(false);
				},
			},
		);
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen && !recordPayment.isPending) reset();
				onOpenChange(nextOpen);
			}}
		>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Record verified payment</DialogTitle>
					<DialogDescription>
						This creates a paid invoice, extends access, and writes an audit
						entry atomically for {owner?.ownerName ?? "this owner"}.
					</DialogDescription>
				</DialogHeader>
				<form className="space-y-4" onSubmit={submit}>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="payment-plan">Plan</Label>
							<Select
								value={planId}
								onValueChange={(value) => setPlanId(value ?? "")}
							>
								<SelectTrigger id="payment-plan" className="w-full">
									<SelectValue placeholder="Choose a plan" />
								</SelectTrigger>
								<SelectContent>
									{plans.map((plan) => (
										<SelectItem key={plan.id} value={plan.id}>
											{plan.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="payment-interval">Billing interval</Label>
							<Select
								value={interval}
								onValueChange={(value) => setInterval(value as BillingInterval)}
							>
								<SelectTrigger id="payment-interval" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{BILLING_INTERVAL_VALUES.map((value) => (
										<SelectItem key={value} value={value}>
											{INTERVAL_LABELS[value]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="rounded-md border bg-muted/40 p-3">
						<p className="text-muted-foreground text-xs">Expected amount</p>
						<p className="font-semibold text-lg">{formatMoney(amount)}</p>
						<p className="text-muted-foreground text-xs">
							The server validates this against the selected plan. Admins cannot
							override plan pricing.
						</p>
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="payment-method">Payment method</Label>
							<Select
								value={paymentMethod}
								onValueChange={(value) =>
									setPaymentMethod(value as PaymentMethod)
								}
							>
								<SelectTrigger id="payment-method" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{PAYMENT_METHOD_VALUES.map((value) => (
										<SelectItem key={value} value={value}>
											{METHOD_LABELS[value]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="payment-time">Paid at</Label>
							<Input
								id="payment-time"
								type="datetime-local"
								value={paidAt}
								onChange={(event) => setPaidAt(event.target.value)}
								required
							/>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="payment-reference">External reference / UTR</Label>
						<Input
							id="payment-reference"
							value={reference}
							onChange={(event) => setReference(event.target.value)}
							placeholder="For example: 423456789012"
							minLength={6}
							maxLength={120}
							required
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="payment-reason">Operational reason</Label>
						<Textarea
							id="payment-reason"
							value={reason}
							onChange={(event) => setReason(event.target.value)}
							placeholder="UPI payment verified against bank statement"
							minLength={8}
							maxLength={500}
							required
						/>
					</div>

					<DialogFooter>
						<Button
							type="submit"
							disabled={
								recordPayment.isPending ||
								!selectedPlan ||
								reference.trim().length < 6 ||
								reason.trim().length < 8
							}
						>
							{recordPayment.isPending ? "Recording…" : "Record payment"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export default function AdminSubscriptionsPage() {
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [planSlug, setPlanSlug] = useState("");
	const [status, setStatus] = useState<AdminSubscriptionStatusFilter | "">("");
	const [selectedOwner, setSelectedOwner] = useState<SubscriptionRow | null>(
		null,
	);
	const { data, isLoading } = useAdminSubscriptions({
		page,
		pageSize: 25,
		search: search.trim() || undefined,
		planSlug: planSlug || undefined,
		status: status || undefined,
	});
	const { data: plansData } = usePlans();

	return (
		<Container className="space-y-6">
			<PageHeader
				title="Subscriptions"
				description="Inspect owner access and record payments after independent verification."
			/>
			<Card>
				<CardContent className="grid gap-3 sm:grid-cols-3">
					<Input
						type="search"
						placeholder="Search owner name or email"
						value={search}
						onChange={(event) => {
							setSearch(event.target.value);
							setPage(1);
						}}
					/>
					<Select
						value={planSlug || "all"}
						onValueChange={(value) => {
							setPlanSlug(value === "all" || !value ? "" : value);
							setPage(1);
						}}
					>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="All plans" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All plans</SelectItem>
							{plansData?.plans.map((plan) =>
								plan.slug ? (
									<SelectItem key={plan.id} value={plan.slug}>
										{plan.name}
									</SelectItem>
								) : null,
							)}
						</SelectContent>
					</Select>
					<Select
						value={status || "all"}
						onValueChange={(value) => {
							setStatus(
								value === "all" || !value
									? ""
									: (value as AdminSubscriptionStatusFilter),
							);
							setPage(1);
						}}
					>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="Any status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">Any status</SelectItem>
							{ADMIN_SUBSCRIPTION_STATUS_FILTER_VALUES.map((value) => (
								<SelectItem key={value} value={value}>
									<span className="capitalize">{value}</span>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Owner</TableHead>
							<TableHead>Plan</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Period end</TableHead>
							<TableHead>Total paid</TableHead>
							<TableHead />
						</TableRow>
					</TableHeader>
					<TableBody>
						{data?.items.map((item) => (
							<TableRow key={item.subscription.id}>
								<TableCell>
									<p className="font-medium">{item.ownerName}</p>
									<p className="text-muted-foreground">{item.ownerEmail}</p>
								</TableCell>
								<TableCell>
									{item.subscription.planName}
									<p className="text-muted-foreground capitalize">
										{item.subscription.billingInterval}
									</p>
								</TableCell>
								<TableCell>
									<StatusBadge
										value={
											item.subscription.expired
												? "expired"
												: item.subscription.status
										}
									/>
								</TableCell>
								<TableCell>
									{formatDate(item.subscription.currentPeriodEnd)}
								</TableCell>
								<TableCell>
									{formatMoney(item.subscription.totalPaid)}
								</TableCell>
								<TableCell className="text-right">
									<Button size="sm" onClick={() => setSelectedOwner(item)}>
										Record payment
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
				{isLoading && (
					<p className="py-8 text-center text-muted-foreground">
						Loading subscriptions…
					</p>
				)}
				{!isLoading && data?.items.length === 0 && (
					<p className="py-8 text-center text-muted-foreground">
						No subscriptions match this search.
					</p>
				)}
				<Pagination
					page={page}
					totalPages={data?.totalPages ?? 0}
					onPageChange={setPage}
				/>
			</Card>

			<RecordPaymentDialog
				owner={selectedOwner}
				plans={plansData?.plans ?? []}
				open={Boolean(selectedOwner)}
				onOpenChange={(open) => {
					if (!open) setSelectedOwner(null);
				}}
			/>
		</Container>
	);
}
