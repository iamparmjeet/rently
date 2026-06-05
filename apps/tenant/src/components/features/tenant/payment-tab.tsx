"use client";

import { cn } from "@rently/ui/lib/utils";
import { useTenantPayments } from "@/hooks/tenant-portal";
import { fmtDate, rupeesCompact } from "@/utils/format";

const TYPE_ICON: Record<string, string> = {
	rent: "🏠",
	utility: "⚡",
	deposit: "🔐",
	reversal: "↩️",
	other: "📄",
};

function getTypeLabel(type: string, utilityType: string | null): string {
	if (type === "utility" && utilityType) {
		return utilityType.charAt(0).toUpperCase() + utilityType.slice(1);
	}
	return type.charAt(0).toUpperCase() + type.slice(1);
}

export function PaymentsTab() {
	const { data, isLoading } = useTenantPayments();

	const payments = data?.payments ?? [];
	const paid = payments.filter((p) => p.amount > 0 && p.type !== "reversal");
	const totalPaid = paid.reduce((s, p) => s + p.amount, 0);

	if (isLoading) {
		return (
			<div className="space-y-3">
				<div className="h-24 animate-pulse rounded-xl bg-muted" />
				<div className="h-64 animate-pulse rounded-xl bg-muted" />
			</div>
		);
	}

	return (
		<div className="space-y-3.5">
			<h1 className="font-extrabold text-xl">Payment History</h1>

			{/* Summary stats */}
			<div className="grid grid-cols-2 gap-2.5">
				<div className="rounded-xl bg-primary p-4 text-primary-foreground">
					<p className="font-medium text-primary-foreground/75 text-xs">
						Total Paid
					</p>
					<p className="mt-1 font-extrabold text-2xl">
						{rupeesCompact(totalPaid)}
					</p>
					<p className="mt-0.5 text-primary-foreground/60 text-xs">All time</p>
				</div>
				<div className="rounded-xl border bg-background p-4">
					<p className="font-medium text-muted-foreground text-xs">
						Transactions
					</p>
					<p className="mt-1 font-extrabold text-2xl">{paid.length}</p>
					<p className="mt-0.5 text-muted-foreground text-xs">Recorded</p>
				</div>
			</div>

			{/* Transactions list */}
			<div className="rounded-xl border bg-background">
				<div className="flex items-center justify-between border-b px-4 py-3">
					<p className="font-bold text-sm">All Transactions</p>
					<span className="text-muted-foreground text-xs">
						{payments.length} records
					</span>
				</div>

				{payments.length === 0 ? (
					<div className="py-10 text-center text-muted-foreground text-sm">
						No payment records yet.
					</div>
				) : (
					<div className="divide-y divide-border">
						{payments.map((p) => {
							const isReversal = p.type === "reversal";
							const label = getTypeLabel(p.type, p.utilityType);
							const icon = TYPE_ICON[p.type] ?? TYPE_ICON.other;

							return (
								<div key={p.id} className="flex items-center gap-3 px-4 py-3.5">
									{/* Type icon bubble */}
									<div
										className={cn(
											"flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg",
											isReversal ? "bg-destructive/10" : "bg-emerald-500/10",
										)}
									>
										<span className="text-lg">{icon}</span>
									</div>

									{/* Info */}
									<div className="min-w-0 flex-1">
										<p className="font-semibold text-sm">{label}</p>
										<p className="text-muted-foreground text-xs">
											{fmtDate(p.paymentDate)}
										</p>
										{(p.paymentMethods || p.referenceNumber) && (
											<p className="truncate text-muted-foreground text-xs">
												{p.paymentMethods?.replace("_", " ")}
												{p.referenceNumber && ` · Ref: ${p.referenceNumber}`}
											</p>
										)}
									</div>

									{/* Amount + badge */}
									<div className="text-right">
										<p
											className={cn(
												"font-bold",
												isReversal ? "text-destructive" : "text-foreground",
											)}
										>
											{isReversal ? "−" : ""}
											{rupeesCompact(Math.abs(p.amount))}
										</p>
										<span
											className={cn(
												"mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-[10px]",
												isReversal
													? "bg-destructive/10 text-destructive"
													: "bg-emerald-500/10 text-emerald-600",
											)}
										>
											<span
												className={cn(
													"h-1.5 w-1.5 rounded-full",
													isReversal ? "bg-destructive" : "bg-emerald-500",
												)}
											/>
											{isReversal ? "Reversed" : "Paid"}
										</span>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
