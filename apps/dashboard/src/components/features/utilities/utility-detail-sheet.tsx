import { Badge } from "@rently/ui/components/badge";
import { Button } from "@rently/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@rently/ui/components/dialog";
import { formatRupees } from "@rently/ui/lib/currency";
import type { UtilityListItem } from "@rently/validators";
import {
	IconCalendar,
	IconHome,
	IconPrinter,
	IconReceipt,
} from "@tabler/icons-react";
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
	onMarkPaidCombined,
}: {
	items: UtilityListItem[];
	rent?: number | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onEdit?: (u: UtilityListItem) => void;
	onMarkPaid: (u: UtilityListItem) => void;
	onMarkPaidCombined?: () => void;
}) {
	if (items.length === 0) return null;

	const first = items[0];
	if (!first) return null;

	const getAmountDue = (u: (typeof items)[number]) =>
		(u as { amountDue?: number }).amountDue ?? u.totalAmount;
	const isPaidDerivedLocal = (u: (typeof items)[number]) =>
		getAmountDue(u) <= 0;
	const utilityTotal = items.reduce(
		(sum, utility) => sum + Math.max(0, getAmountDue(utility)),
		0,
	);
	const originalTotal = items.reduce(
		(sum, utility) => sum + utility.totalAmount,
		0,
	);
	const hasAnyDiscount = items.some((u) =>
		(u.credits ?? []).some((credit) => credit.type === "discount"),
	);
	const statementTotal = utilityTotal + (rent ?? 0);
	const isCombinedBill = rent !== null;
	const allPaid =
		items.every(isPaidDerivedLocal) && (!isCombinedBill || (rent ?? 0) <= 0);
	const unpaidCount = items.filter((u) => !isPaidDerivedLocal(u)).length;
	const periodStart = first.previousReadingDate ?? first.currentReadingDate;
	const periodEnd = first.currentReadingDate;
	const days = Math.max(
		0,
		Math.round(
			(new Date(periodEnd).getTime() - new Date(periodStart).getTime()) /
				(1000 * 60 * 60 * 24),
		),
	);
	const combinedBillHref = isCombinedBill
		? `/combined-bill?ids=${items.map((i) => i.id).join(",")}&rent=${rent ?? 0}`
		: items.length === 1
			? `/utilities/${items[0]!.id}`
			: null;

	// Recommendation A: rent is always 1 calendar month (month of periodEnd), utility may be arrears
	const rentMonthLabel = new Intl.DateTimeFormat("en-IN", {
		month: "long",
		year: "numeric",
	}).format(new Date(periodEnd));
	const rentPeriodStart = new Date(
		new Date(periodEnd).getFullYear(),
		new Date(periodEnd).getMonth(),
		1,
	);
	const rentPeriodEnd = new Date(
		new Date(periodEnd).getFullYear(),
		new Date(periodEnd).getMonth() + 1,
		0,
	);
	const rentPeriodLabel =
		rentPeriodStart.toLocaleDateString("en-IN", {
			day: "2-digit",
			month: "short",
		}) +
		" – " +
		rentPeriodEnd.toLocaleDateString("en-IN", {
			day: "2-digit",
			month: "short",
			year: "numeric",
		});
	const isLongArrears = days > 60;
	const billingPeriodSub =
		isCombinedBill && isLongArrears
			? `${days} days • Rent: ${rentMonthLabel} only`
			: `${days} days`;

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
					<div className="min-w-0">
						<DialogTitle className="font-bold text-xl tracking-tight">
							{first.tenantName ?? "Tenant"}
						</DialogTitle>
						<DialogDescription>
							{first.propertyName} · Unit {first.unitNumber}
						</DialogDescription>
					</div>
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
							sub={billingPeriodSub}
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
											{rentPeriodLabel} • Monthly rent for this unit
										</p>
										{isLongArrears ? (
											<p className="mt-0.5 text-[10px] text-amber-600">
												Utility arrears: {days} days • Rent shown is 1 month
												only
											</p>
										) : null}
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
								onEdit={
									onEdit &&
									!isPaidDerivedLocal(utility) &&
									!utility.hasReversedPayment
										? () => onEdit(utility)
										: undefined
								}
								onMarkPaid={() => onMarkPaid(utility)}
								hideDownload={isCombinedBill}
							/>
						))}
					</div>

					<footer className="flex flex-col gap-2 rounded-xl border-2 border-foreground bg-muted/20 p-4">
						<div className="flex items-end justify-between gap-4">
							<div>
								<p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
									{hasAnyDiscount ? "Amount due" : "Total billed"}
								</p>
								<p className="mt-1 text-muted-foreground text-xs">
									{isCombinedBill
										? "Rent plus utility charges"
										: allPaid
											? "No outstanding balance"
											: "Payment action required"}
								</p>
								{hasAnyDiscount ? (
									<p className="mt-1 text-muted-foreground text-xs line-through">
										Original {formatRupees(originalTotal + (rent ?? 0))}
									</p>
								) : null}
							</div>
							<p className="font-bold text-2xl tabular-nums">
								{formatRupees(statementTotal)}
							</p>
						</div>
					</footer>

					{/* Footer actions — after total callout */}
					<div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
						<Button variant="outline" onClick={() => onOpenChange(false)}>
							Close
						</Button>
						{combinedBillHref ? (
							<Button
								variant="outline"
								className="gap-1.5"
								onClick={() =>
									window.open(
										`${combinedBillHref}?print=true`,
										"_blank",
										"noopener",
									)
								}
							>
								<IconPrinter className="size-3.5" />
								{isCombinedBill ? "Print combined bill" : "Print bill"}
							</Button>
						) : null}
						{!allPaid ? (
							isCombinedBill && onMarkPaidCombined ? (
								<Button onClick={onMarkPaidCombined}>
									Record Combined Payment
								</Button>
							) : (
								<Button
									onClick={() => {
										const firstUnpaid = items.find((u) => getAmountDue(u) > 0);
										if (firstUnpaid) onMarkPaid(firstUnpaid);
									}}
								>
									Record payment
								</Button>
							)
						) : null}
					</div>
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
