"use client";

import { Skeleton } from "@rently/ui/components/skeleton";
import { formatRupees } from "@rently/ui/lib/currency";
import { format } from "date-fns";
import Link from "next/link";
import { getTypeConfig } from "@/components/features/payments/payment-helpers";

interface RecentTransactionItem {
	id: string;
	amount: number;
	type: string;
	paymentDate: Date;
	tenantName: string;
	description: string | null;
}

interface RecentTransactionsProps {
	transactions: RecentTransactionItem[];
	className?: string;
	isLoading?: boolean;
}

export function RecentTransactions({
	className = "",
	transactions,
	isLoading,
}: RecentTransactionsProps) {
	return (
		<div
			className={`overflow-hidden rounded-xl border bg-card shadow-sm ${className}`}
		>
			<div className="border-b bg-gradient-to-br from-primary/[0.10] via-primary/[0.025] to-transparent px-5 pt-5 pb-4">
				<div className="flex items-center justify-between">
					<div>
						<p className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
							Activity
						</p>
						<h3 className="mt-0.5 font-semibold text-sm">
							Recent transactions
						</h3>
						<p className="mt-1 text-muted-foreground text-xs">
							Latest rent and payment activity
						</p>
					</div>
					{!isLoading && transactions.length > 0 && (
						<Link
							href="/payments"
							className="text-muted-foreground text-xs transition-colors hover:text-foreground"
						>
							View all →
						</Link>
					)}
				</div>
			</div>

			<div className="px-5">
				{isLoading ? (
					<Loading />
				) : transactions.length === 0 ? (
					<EmptyState />
				) : (
					<div className="flex flex-col divide-y">
						{transactions.map((tx) => {
							const config = getTypeConfig(tx.type);

							return (
								<div key={tx.id} className="flex items-center gap-4 py-3.5">
									<div
										className={`flex size-9 shrink-0 items-center justify-center rounded-xl font-semibold text-sm ${config.avatarBg} ${config.avatarText}`}
									>
										{tx.type.charAt(0).toUpperCase()}
									</div>

									<div className="min-w-0 flex-1">
										<p className="truncate font-medium text-sm">
											{tx.tenantName}
										</p>
										<p className="text-muted-foreground text-xs">
											{format(tx.paymentDate, "d MMM yyyy")}
											{" · "}
											<span className="capitalize">{config.label}</span>
										</p>
									</div>

									<p className="shrink-0 font-semibold text-sm tabular-nums">
										{formatRupees(tx.amount)}
									</p>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}

function Loading() {
	return (
		<div className="flex flex-col divide-y">
			{Array.from({ length: 4 }).map((_, i) => (
				<div key={i} className="flex items-center gap-4 py-3.5">
					<Skeleton
						className="size-9 rounded-xl"
						style={{ animationDelay: `${i * 120}ms` }}
					/>
					<div className="flex-1 space-y-2">
						<Skeleton
							className="h-3 w-36"
							style={{ animationDelay: `${i * 120}ms` }}
						/>
						<Skeleton
							className="h-3 w-24"
							style={{ animationDelay: `${i * 120 + 60}ms` }}
						/>
					</div>
					<Skeleton
						className="h-3 w-20"
						style={{ animationDelay: `${i * 120}ms` }}
					/>
				</div>
			))}
		</div>
	);
}

function EmptyState() {
	return (
		<div className="flex flex-col items-center justify-center py-10 text-center">
			<p className="font-medium text-muted-foreground text-sm">
				No payments recorded yet
			</p>
			<p className="mt-1 text-muted-foreground text-xs">
				Transactions will appear here once you record payments.
			</p>
		</div>
	);
}
