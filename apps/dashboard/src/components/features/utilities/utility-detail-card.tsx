import { Badge } from "@rently/ui/components/badge";
import { Button } from "@rently/ui/components/button";
import { formatRupees } from "@rently/ui/lib/currency";
import type { UtilityListItem } from "@rently/validators";
import {
	IconBolt,
	IconCheck,
	IconDownload,
	IconDroplet,
	IconEdit,
	IconTool,
} from "@tabler/icons-react";
import { getUtilityDocumentAction } from "./utility-row-actions";

export function UtilityDetailCard({
	utility: u,
	onEdit,
	onMarkPaid,
	hideDownload,
}: {
	utility: UtilityListItem;
	onEdit?: () => void;
	onMarkPaid: () => void;
	hideDownload?: boolean;
}) {
	const isElectricity = u.utilityType === "electricity";
	const documentAction = getUtilityDocumentAction({
		utilityId: u.id,
		receiptPaymentId: u.receiptPaymentId,
	});
	const usageAmount = Math.round(
		Number(u.unitsUsed ?? 0) * Number(u.ratePerUnit ?? 0),
	);
	const hasReconciledBreakdown =
		usageAmount + Number(u.fixedCharge ?? 0) === u.totalAmount;
	const amountDue = (u as { amountDue?: number }).amountDue ?? u.totalAmount;
	const isPaidDerived = amountDue <= 0;
	const hasReversedPayment = u.hasReversedPayment ?? false;
	const creditTotal = (u.credits ?? []).reduce(
		(sum, credit) => sum + credit.amount,
		0,
	);
	const hasDiscount = creditTotal !== 0;
	const showDiscount = hasDiscount && amountDue !== u.totalAmount;
	const discountedAmount =
		u.totalAmount +
		(u.credits ?? []).reduce((sum, credit) => sum + credit.amount, 0);
	const displayedAmount = isPaidDerived ? discountedAmount : amountDue;
	const amountLabel = isPaidDerived
		? "Bill amount"
		: showDiscount
			? "Amount due"
			: "Billed amount";
	const typeLabel =
		u.utilityType === "electricity"
			? "Electricity"
			: u.utilityType === "water"
				? "Water"
				: "Maintenance";

	return (
		<section className="overflow-hidden rounded-xl border bg-background">
			<header className="flex items-center justify-between gap-3 border-b bg-muted/25 px-4 py-3">
				<div className="flex items-center gap-2.5">
					<div
						className={`flex size-8 items-center justify-center rounded-lg ${
							u.utilityType === "electricity"
								? "bg-amber-50 text-amber-600"
								: u.utilityType === "water"
									? "bg-sky-50 text-sky-600"
									: "bg-violet-50 text-violet-600"
						}`}
					>
						{u.utilityType === "electricity" ? (
							<IconBolt className="size-4" />
						) : u.utilityType === "water" ? (
							<IconDroplet className="size-4" />
						) : (
							<IconTool className="size-4" />
						)}
					</div>
					<div>
						<h3 className="font-semibold text-sm">{typeLabel}</h3>
						<p className="text-muted-foreground text-xs">
							{new Date(u.currentReadingDate).toLocaleDateString("en-IN", {
								day: "2-digit",
								month: "long",
								year: "numeric",
							})}
						</p>
					</div>
				</div>
				<Badge
					variant="secondary"
					className={
						isPaidDerived
							? "bg-emerald-50 text-emerald-700"
							: "bg-amber-50 text-amber-700"
					}
				>
					{isPaidDerived
						? "Paid"
						: hasReversedPayment
							? "Payment voided"
							: "Unpaid"}
				</Badge>
			</header>

			{isElectricity ? (
				<div className="grid grid-cols-2 gap-x-5 gap-y-4 px-4 py-4 sm:grid-cols-5">
					<DetailValue
						label="Previous"
						value={Number(u.previousReading).toFixed(2)}
					/>
					<DetailValue
						label="Current"
						value={Number(u.currentReading).toFixed(2)}
					/>
					<DetailValue
						label="Usage"
						value={`${Number(u.unitsUsed).toFixed(2)} kWh`}
					/>
					{hasReconciledBreakdown ? (
						<>
							<DetailValue
								label="Rate"
								value={`${formatRupees(u.ratePerUnit ?? 0)}/kWh`}
							/>
							<DetailValue
								label="Fixed charge"
								value={formatRupees(u.fixedCharge ?? 0)}
							/>
						</>
					) : null}
				</div>
			) : (
				<div className="px-4 py-4">
					<p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
						Description
					</p>
					<p className="mt-1 text-sm">
						{u.description?.trim() || "Flat utility charge"}
					</p>
				</div>
			)}

			<footer className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex gap-5">
					<div>
						<p className="text-[10px] text-muted-foreground uppercase tracking-wide">
							{amountLabel}
						</p>
						<p className="mt-0.5 font-bold text-lg tabular-nums">
							{formatRupees(displayedAmount)}
						</p>
						{showDiscount ? (
							<p className="text-muted-foreground text-xs line-through">
								Original {formatRupees(u.totalAmount)}
							</p>
						) : null}
					</div>
					{isPaidDerived && showDiscount ? (
						<div>
							<p className="text-[10px] text-muted-foreground uppercase tracking-wide">
								Due
							</p>
							<p className="mt-0.5 font-bold text-emerald-700 text-lg tabular-nums">
								{formatRupees(amountDue)}
							</p>
						</div>
					) : null}
				</div>
				<div className="flex flex-wrap items-center gap-1">
					{onEdit && (
						<Button variant="ghost" size="sm" onClick={onEdit}>
							<IconEdit className="size-3.5" />
							Edit
						</Button>
					)}
					{!hideDownload ? (
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								window.open(documentAction.href, "_blank", "noopener")
							}
						>
							<IconDownload className="size-3.5" />
							{documentAction.label}
						</Button>
					) : null}
					{!isPaidDerived ? (
						<Button size="sm" onClick={onMarkPaid}>
							<IconCheck className="size-3.5" />
							Record payment
						</Button>
					) : null}
				</div>
			</footer>
		</section>
	);
}

function DetailValue({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wide">
				{label}
			</p>
			<p className="mt-1 font-medium text-sm tabular-nums">{value}</p>
		</div>
	);
}
