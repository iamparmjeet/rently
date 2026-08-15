import { Badge } from "@rently/ui/components/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@rently/ui/components/dialog";
import { formatRupees } from "@rently/ui/lib/currency";
import type { UtilityListItem } from "@rently/validators";
import { IconCalendar, IconHome, IconReceipt } from "@tabler/icons-react";
import { UtilityDetailCard } from "./utility-detail-card";

function formatDate(value: Date) {
	return new Date(value).toLocaleDateString("en-IN", {
		day: "2-digit",
		month: "long",
		year: "numeric",
	});
}

export function UtilityDetailDialog({
	items,
	rent = null,
	open,
	onOpenChange,
	onEdit,
	onMarkPaid,
}: {
	items: UtilityListItem[];
	rent?: number | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onEdit?: (u: UtilityListItem) => void;
	onMarkPaid: (u: UtilityListItem) => void;
}) {
	if (items.length === 0) return null;

	const first = items[0];
	if (!first) return null;

	const utilityTotal = items.reduce(
		(sum, utility) => sum + utility.totalAmount,
		0,
	);
	const statementTotal = utilityTotal + (rent ?? 0);
	const isCombinedBill = rent !== null;
	const allPaid = items.every((utility) => utility.isPaid);
	const unpaidCount = items.filter((utility) => !utility.isPaid).length;
	const periodStart = first.previousReadingDate ?? first.currentReadingDate;
	const periodEnd = first.currentReadingDate;
	const days = Math.max(
		0,
		Math.round(
			(new Date(periodEnd).getTime() - new Date(periodStart).getTime()) /
				(1000 * 60 * 60 * 24),
		),
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[calc(100vh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
				<DialogHeader className="border-b bg-muted/25 px-6 py-5 pr-16">
					<div className="mb-2 flex items-center gap-2">
						<p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
							{isCombinedBill ? "Combined bill" : "Utility statement"}
						</p>
						<Badge
							variant="secondary"
							className={
								allPaid
									? "bg-emerald-50 text-emerald-700"
									: "bg-amber-50 text-amber-700"
							}
						>
							{allPaid
								? isCombinedBill
									? "Utilities paid"
									: "Paid"
								: `${unpaidCount} unpaid`}
						</Badge>
					</div>
					<DialogTitle className="font-bold text-xl tracking-tight">
						{first.tenantName ?? "Tenant"}
					</DialogTitle>
					<DialogDescription>
						{first.propertyName} · Unit {first.unitNumber}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-5 p-4 sm:p-6">
					<section
						aria-label="Utility statement summary"
						className="grid grid-cols-2 gap-3 sm:grid-cols-3"
					>
						<SummaryItem
							className="col-span-2 sm:col-span-1"
							icon={<IconCalendar className="size-4" />}
							label="Billing period"
							value={`${formatDate(periodStart)} – ${formatDate(periodEnd)}`}
							sub={`${days} days`}
						/>
						<SummaryItem
							icon={<IconHome className="size-4" />}
							label="Service location"
							value={`${first.propertyName} · ${first.unitNumber}`}
							sub={`${items.length} ${items.length === 1 ? "charge" : "charges"}`}
						/>
						<SummaryItem
							icon={<IconReceipt className="size-4" />}
							label={isCombinedBill ? "Bill total" : "Statement total"}
							value={formatRupees(statementTotal)}
							sub={
								isCombinedBill
									? "Rent and utilities"
									: allPaid
										? "Fully paid"
										: `${unpaidCount} awaiting payment`
							}
						/>
					</section>

					<div className="space-y-3">
						<div>
							<h2 className="font-semibold text-sm">Bill breakdown</h2>
							<p className="text-muted-foreground text-xs">
								{isCombinedBill
									? "Rent and utility charges for this billing period."
									: "Review amounts, payment state, and available documents."}
							</p>
						</div>
						{isCombinedBill && (
							<div className="flex items-center justify-between rounded-xl border bg-background px-4 py-3">
								<div className="flex items-center gap-2.5">
									<div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
										<IconHome className="size-4" />
									</div>
									<div>
										<p className="font-semibold text-sm">Rent</p>
										<p className="text-muted-foreground text-xs">
											Monthly rent for this unit
										</p>
									</div>
								</div>
								<p className="font-bold text-base tabular-nums">
									{formatRupees(rent ?? 0)}
								</p>
							</div>
						)}
						{items.map((utility) => (
							<UtilityDetailCard
								key={utility.id}
								utility={utility}
								onEdit={onEdit ? () => onEdit(utility) : undefined}
								onMarkPaid={() => onMarkPaid(utility)}
							/>
						))}
					</div>

					<footer className="flex items-end justify-between gap-4 rounded-xl border-2 border-foreground bg-muted/20 p-4">
						<div>
							<p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
								Total billed
							</p>
							<p className="mt-1 text-muted-foreground text-xs">
								{isCombinedBill
									? "Rent plus utility charges"
									: allPaid
										? "No outstanding balance"
										: "Payment action required"}
							</p>
						</div>
						<p className="font-bold text-2xl tabular-nums">
							{formatRupees(statementTotal)}
						</p>
					</footer>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function SummaryItem({
	className,
	icon,
	label,
	value,
	sub,
}: {
	className?: string;
	icon: React.ReactNode;
	label: string;
	value: string;
	sub: string;
}) {
	return (
		<div className={`rounded-xl border bg-background p-3.5 ${className ?? ""}`}>
			<div className="mb-3 flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
				{icon}
			</div>
			<p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
				{label}
			</p>
			<p className="mt-1 font-semibold text-sm">{value}</p>
			<p className="mt-1 text-muted-foreground text-xs">{sub}</p>
		</div>
	);
}
