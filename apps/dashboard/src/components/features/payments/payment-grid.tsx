"use client";

import { Skeleton } from "@rently/ui/components/skeleton";
import { EmptyState } from "@rently/ui/shared/empty-state";
import type { PaymentListItem } from "@rently/validators";
import { IconReceipt } from "@tabler/icons-react";
import { PaymentCard } from "./payment-card";
import { PaymentRow } from "./payment-row";

export interface PaymentGridProps {
	payments: PaymentListItem[];
	allPayments: PaymentListItem[];
	reversedPaymentIds: Set<string>;
	isLoading?: boolean;
	viewMode: "cards" | "rows";
	voidingId: string | null;
	onViewDetail: (payment: PaymentListItem) => void;
	onVoid: (payment: PaymentListItem) => void;
}

export function PaymentGrid({
	payments,
	allPayments,
	reversedPaymentIds,
	isLoading,
	viewMode,
	voidingId,
	onViewDetail,
	onVoid,
}: PaymentGridProps) {
	if (isLoading) {
		return viewMode === "cards" ? (
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: 6 }).map((_, i) => (
					<PaymentCardSkeleton key={i} />
				))}
			</div>
		) : (
			<div className="overflow-hidden rounded-xl border bg-card shadow-sm">
				{Array.from({ length: 6 }).map((_, i) => (
					<PaymentRowSkeleton key={i} isLast={i === 5} />
				))}
			</div>
		);
	}

	if (payments.length === 0) {
		return (
			<EmptyState
				className="rounded-xl border bg-card shadow-sm"
				icon={IconReceipt}
				title={
					allPayments.length === 0
						? "No payments yet"
						: "No payments match this filter"
				}
				description={
					allPayments.length === 0
						? "Record your first payment to start tracking rent collections."
						: undefined
				}
			/>
		);
	}

	if (viewMode === "cards") {
		return (
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{payments.map((payment) => (
					<PaymentCard
						key={payment.id}
						payment={payment}
						isReversed={reversedPaymentIds.has(payment.id)}
						isVoiding={voidingId === payment.id}
						onClick={() => onViewDetail(payment)}
						onVoid={() => onVoid(payment)}
					/>
				))}
			</div>
		);
	}

	return (
		<div className="overflow-hidden rounded-xl border bg-card shadow-sm">
			{payments.map((payment, index) => (
				<PaymentRow
					key={payment.id}
					payment={payment}
					isReversed={reversedPaymentIds.has(payment.id)}
					isVoiding={voidingId === payment.id}
					isLast={index === payments.length - 1}
					onClick={() => onViewDetail(payment)}
					onVoid={() => onVoid(payment)}
				/>
			))}
		</div>
	);
}

function PaymentCardSkeleton() {
	return (
		<div className="overflow-hidden rounded-lg border border-border/80 bg-card">
			<div className="space-y-3 border-b px-5 pt-5 pb-4">
				<div className="flex items-start justify-between">
					<div className="flex items-start gap-3">
						<Skeleton className="size-10 rounded-xl" />
						<div className="space-y-1.5 pt-0.5">
							<Skeleton className="h-3 w-16" />
							<Skeleton className="h-4 w-28" />
							<Skeleton className="h-3 w-36" />
						</div>
					</div>
					<Skeleton className="h-5 w-14 rounded-full" />
				</div>
			</div>
			<div className="space-y-3 px-5 py-4">
				<div className="flex items-end justify-between gap-3">
					<Skeleton className="h-12 w-20" />
					<Skeleton className="h-8 w-24" />
				</div>
				<div className="space-y-1.5">
					<Skeleton className="h-3 w-full" />
					<Skeleton className="h-3 w-3/4" />
				</div>
			</div>
			<div className="flex items-center justify-between border-t px-5 py-3.5">
				<Skeleton className="h-3 w-32" />
				<Skeleton className="h-7 w-16" />
			</div>
		</div>
	);
}

function PaymentRowSkeleton({ isLast }: { isLast?: boolean }) {
	return (
		<div
			className={[
				"flex items-center gap-3 px-4 py-3.5 sm:px-5",
				isLast ? "" : "border-b",
			].join(" ")}
		>
			<Skeleton className="size-10 shrink-0 rounded-xl" />
			<div className="min-w-0 flex-1 space-y-1.5">
				<Skeleton className="h-4 w-32" />
				<Skeleton className="h-3 w-48" />
			</div>
			<div className="flex min-w-23 shrink-0 flex-col items-end gap-1">
				<Skeleton className="h-4 w-20" />
				<Skeleton className="h-3 w-16" />
			</div>
			<Skeleton className="size-8 rounded-md" />
			<Skeleton className="size-4 rounded-sm" />
		</div>
	);
}
