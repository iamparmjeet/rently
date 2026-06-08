"use client";

import { Skeleton } from "@rently/ui/components/skeleton";
import { formatRupees } from "@rently/ui/lib/currency";
import { format } from "date-fns";

interface RecentTransactionItem {
	id: string;
	amount: number; // paise
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

// Helpers
const TYPE_CONFIG: Record<
	string,
	{ label: string; color: string; bg: string }
> = {
	rent: { label: "Rent", color: "text-green-700", bg: "bg-green-100" },
	utility: { label: "Utility", color: "text-blue-700", bg: "bg-blue-100" },
	deposit: { label: "Deposit", color: "text-purple-700", bg: "bg-purple-100" },
	other: { label: "Other", color: "text-orange-700", bg: "bg-orange-100" },
};

function getTypeConfig(type: string) {
	return (
		TYPE_CONFIG[type] ?? {
			label: type,
			color: "text-muted-foreground",
			bg: "bg-muted",
		}
	);
}

export function RecentTransactions({
	className = "",
	transactions,
	isLoading,
}: RecentTransactionsProps) {
	return (
		<div
			className={`rounded-2xl border border-border/40 bg-card p-6 shadow-sm ${className}`}
		>
			{/* Headers */}
			<div className="flex items-center justify-between">
				<div>
					<h3 className="font-semibold text-base">Recent Transactions</h3>
					<p className="mt-0.5 text-muted-foreground text-sm">
						Latest rent and payment activity
					</p>
				</div>
				{!isLoading && transactions.length > 0 && (
					<span className="text-muted-foreground text-xs">
						Last {transactions.length}
					</span>
				)}
			</div>

			{/* Body */}
			{isLoading ? (
				<Loading />
			) : transactions.length === 0 ? (
				<EmptyState />
			) : (
				<div className="mt-4 flex flex-col divide-y divide-border/40">
					{transactions.map((tx) => {
						const config = getTypeConfig(tx.type);

						const initial = tx.tenantName.charAt(0).toUpperCase();

						return (
							<div key={tx.id} className="flex items-center gap-4 py-3.5">
								{/* Avatar */}
								<div
									className={`flex size-9 shrink-0 items-center justify-center rounded-full font-semibold text-sm ${config.bg} ${config.color}`}
								>
									{initial}
								</div>

								{/* Name + meta */}
								<div className="min-w-0 flex-1">
									<p className="truncate font-medium text-sm">
										{tx.tenantName}
									</p>
									<p className="text-muted-foreground text-xs">
										{format(tx.paymentDate, "d MMM yyyy")}
										{" · "}
										<span className={`capitalize ${config.color}`}>
											{config.label}
										</span>
									</p>
								</div>

								{/* Amount */}
								<p className="shrink-0 font-semibold text-sm tabular-nums">
									{formatRupees(tx.amount)}
								</p>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

function Loading() {
	return (
		<div className="mt-4 flex flex-col divide-y divide-border/40">
			{Array.from({ length: 4 }).map((_, i) => (
				<div key={i} className="flex items-center gap-4 py-3.5">
					<Skeleton
						className="size-9 rounded-full"
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
		<div className="mt-6 flex flex-col items-center justify-center py-8 text-center">
			<p className="font-medium text-muted-foreground text-sm">
				No payments recorded yet
			</p>
			<p className="mt-1 text-muted-foreground text-xs">
				Transactions will appear here once you record payments.
			</p>
		</div>
	);
}
