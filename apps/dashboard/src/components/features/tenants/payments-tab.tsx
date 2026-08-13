"use client";

import { PAYMENT_TYPES } from "@rently/db/constants/rent-constants";
import { Badge } from "@rently/ui/components/badge";
import { Button } from "@rently/ui/components/button";
import { formatRupees } from "@rently/ui/lib/currency";
import type { PaymentListItem, TenantDetail } from "@rently/validators";
import { IconDownload } from "@tabler/icons-react";
import { AddPaymentButton } from "@/components/features/payments/add-payment-button";
import { useTenantPaymentExport } from "@/hooks/payments";

// ── Payment method display labels ************

const METHOD_LABELS: Record<string, string> = {
	upi: "UPI (GPay/PhonePe)",
	bank_transfer: "Bank Transfer / NEFT",
	cash: "Cash",
	cheque: "Cheque",
	online: "Online Banking",
};

// ── Payment type style config ****************

function getPaymentConfig(type: string) {
	switch (type) {
		case PAYMENT_TYPES.RENT:
			return { label: "Rent", accentColor: "bg-primary" };
		case PAYMENT_TYPES.UTILITY:
			return { label: "Utility", accentColor: "bg-amber-500" };
		case PAYMENT_TYPES.DEPOSIT:
			return { label: "Deposit", accentColor: "bg-emerald-500" };
		case PAYMENT_TYPES.REVERSAL:
			return { label: "Reversal", accentColor: "bg-destructive" };
		default:
			return { label: "Payment", accentColor: "bg-muted" };
	}
}

// ── Payment row ****************

function PaymentRow({ payment }: { payment: PaymentListItem }) {
	const config = getPaymentConfig(payment.type);
	const isReversal = payment.type === PAYMENT_TYPES.REVERSAL;

	return (
		<div className="flex items-center gap-3 py-4">
			{/* Accent bar */}
			<div className={`h-10 w-1 shrink-0 rounded-full ${config.accentColor}`} />

			{/* Details */}
			<div className="min-w-0 flex-1">
				<p className="font-medium text-sm">{config.label}</p>
				<p className="text-muted-foreground text-xs">
					{new Date(payment.paymentDate).toLocaleDateString("en-IN", {
						day: "numeric",
						month: "short",
						year: "numeric",
					})}
					{payment.paymentMethods && (
						<>
							{" "}
							·{" "}
							{METHOD_LABELS[payment.paymentMethods] ?? payment.paymentMethods}
						</>
					)}
				</p>
			</div>

			{/* Amount + status */}
			<div className="shrink-0 text-right">
				<p
					className={`font-semibold text-sm ${isReversal ? "text-destructive" : ""}`}
				>
					{isReversal ? "−" : ""}
					{formatRupees(Math.abs(payment.amount))}
				</p>
				<Badge
					variant={isReversal ? "destructive" : "secondary"}
					className="mt-0.5 text-xs"
				>
					{isReversal ? "Reversed" : "Paid"}
				</Badge>
			</div>
		</div>
	);
}

// ── Mode of payment breakdown **************

function ModeOfPaymentBar({
	method,
	percentage,
}: {
	method: string;
	percentage: number;
}) {
	return (
		<div className="space-y-1">
			<div className="flex items-center justify-between text-sm">
				<span>{METHOD_LABELS[method] ?? method}</span>
				<span className="font-medium">{percentage}%</span>
			</div>
			<div className="h-1.5 w-full rounded-full bg-muted">
				<div
					className="h-1.5 rounded-full bg-primary transition-all"
					style={{ width: `${percentage}%` }}
				/>
			</div>
		</div>
	);
}

// ── Tab component ****************

interface PaymentsTabProps {
	tenant: TenantDetail;
	payments: PaymentListItem[];
	stats: {
		monthlyRent: number;
		totalPaidYTD: number;
		overdueAmount: number;
	};
}

export function PaymentsTab({ tenant, payments, stats }: PaymentsTabProps) {
	const exportPayments = useTenantPaymentExport();

	// Sort newest first
	const sorted = [...payments].sort(
		(a, b) =>
			new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime(),
	);

	// Pending = un-reversed rent this month
	// Simplified: if any payment exists this month, pending = 0
	const now = new Date();
	const thisMonthPayments = payments.filter((p) => {
		const d = new Date(p.paymentDate);
		return (
			d.getMonth() === now.getMonth() &&
			d.getFullYear() === now.getFullYear() &&
			p.amount > 0
		);
	});
	const pendingAmount = thisMonthPayments.length > 0 ? 0 : stats.monthlyRent;

	// Mode of payment breakdown — count by method (positive payments only)
	const positivePayments = payments.filter((p) => p.amount > 0);
	const methodCounts = new Map<string, number>();
	for (const p of positivePayments) {
		const method = p.paymentMethods ?? "other";
		methodCounts.set(method, (methodCounts.get(method) ?? 0) + 1);
	}
	const totalPaymentsCount = positivePayments.length;
	const methodBreakdown = Array.from(methodCounts.entries())
		.map(([method, count]) => ({
			method,
			percentage: Math.round((count / totalPaymentsCount) * 100),
		}))
		.sort((a, b) => b.percentage - a.percentage);

	function handleTenantExport() {
		exportPayments.mutate({
			tenantId: tenant.id,
			tenantName: tenant.name,
		});
	}

	return (
		<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
			{/* ── Left: Payment history ************** */}
			<div className="lg:col-span-2">
				<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<h3 className="font-semibold text-base">Payment History</h3>

					<div className="flex flex-wrap items-center gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="gap-1.5"
							disabled={exportPayments.isPending}
							onClick={handleTenantExport}
						>
							<IconDownload className="size-4" />
							{exportPayments.isPending ? "Preparing…" : "Export CSV"}
						</Button>

						<AddPaymentButton
							leaseId={
								tenant.activeLeases.length === 1
									? tenant.activeLeases[0]?.id
									: undefined
							}
							leaseIds={tenant.activeLeases.map(
								(activeLease) => activeLease.id,
							)}
							variant="default"
							withIcon
						/>
					</div>
				</div>

				{sorted.length === 0 ? (
					<div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground text-sm">
						No payments recorded yet.
					</div>
				) : (
					<div className="divide-y">
						{sorted.map((p) => (
							<PaymentRow key={p.id} payment={p} />
						))}
					</div>
				)}
			</div>

			{/* ── Right: Balance summary ********** */}
			<div className="space-y-6">
				{/* Balance Summary */}
				<section>
					<p className="mb-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
						Balance Summary
					</p>
					<div className="space-y-2.5">
						<div className="flex items-center justify-between text-sm">
							<span>Monthly Rent</span>
							<span className="font-medium">
								{formatRupees(stats.monthlyRent)}
							</span>
						</div>
						<div className="flex items-center justify-between text-sm">
							<span>Pending</span>
							<span
								className={`font-semibold ${pendingAmount > 0 ? "text-amber-600" : ""}`}
							>
								{formatRupees(pendingAmount)}
							</span>
						</div>
						<div className="flex items-center justify-between text-sm">
							<span>Overdue</span>
							<span
								className={`font-semibold ${stats.overdueAmount > 0 ? "text-destructive" : ""}`}
							>
								{formatRupees(stats.overdueAmount)}
							</span>
						</div>
						<div className="border-t pt-2.5">
							<div className="flex items-center justify-between text-sm">
								<span className="font-medium">Total Paid YTD</span>
								<span className="font-semibold text-emerald-600">
									{formatRupees(stats.totalPaidYTD)}
								</span>
							</div>
						</div>
					</div>
				</section>

				{/* Mode of Payment */}
				{methodBreakdown.length > 0 && (
					<section>
						<p className="mb-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
							Mode of Payment
						</p>
						<div className="space-y-3">
							{methodBreakdown.map(({ method, percentage }) => (
								<ModeOfPaymentBar
									key={method}
									method={method}
									percentage={percentage}
								/>
							))}
						</div>
					</section>
				)}

				{/* Advance Payments — placeholder, no schema support yet */}
				<section>
					<p className="mb-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
						Advance Payments
					</p>
					<p className="text-muted-foreground text-sm">No advance recorded</p>
					<Button variant="outline" size="sm" className="mt-2" disabled>
						Record Advance
					</Button>
				</section>
			</div>
		</div>
	);
}
