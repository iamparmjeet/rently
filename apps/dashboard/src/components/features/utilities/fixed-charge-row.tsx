import { Badge } from "@rently/ui/components/badge";
import { Button } from "@rently/ui/components/button";
import { formatRupees } from "@rently/ui/lib/currency";
import type { UtilityListItem } from "@rently/validators";
import {
	IconCheck,
	IconDownload,
	IconDroplet,
	IconTool,
} from "@tabler/icons-react";
import {
	getUtilityDocumentAction,
	isUtilityRowActionTarget,
} from "./utility-row-actions";
import { UtilityRowMenu } from "./utility-row-menu";

interface FixedChargeRowProps {
	utility: UtilityListItem;
	onEdit: () => void;
	onDelete: () => void;
	onMarkPaid: () => void;
	onViewDetail: () => void;
	isDeleting: boolean;
}

export function FixedChargeRow({
	utility: u,
	onEdit,
	onDelete,
	onMarkPaid,
	onViewDetail,
	isDeleting,
}: FixedChargeRowProps) {
	const isWater = u.utilityType === "water";
	const typeLabel = isWater ? "Water" : "Maintenance";
	const dateDisplay = new Date(u.currentReadingDate).toLocaleDateString(
		"en-IN",
		{
			day: "2-digit",
			month: "short",
			year: "numeric",
		},
	);
	const documentAction = getUtilityDocumentAction({
		utilityId: u.id,
		receiptPaymentId: u.receiptPaymentId,
	});
	const amountDue = (u as { amountDue?: number }).amountDue ?? u.totalAmount;
	const isPaidDerived = amountDue <= 0;
	const hasDiscount =
		(u.credits?.length ?? 0) > 0 && amountDue !== u.totalAmount;

	function handleWhatsApp() {
		if (!u.tenantPhone) return;
		const message = encodeURIComponent(
			`Dear ${u.tenantName ?? "Tenant"}, your ${typeLabel.toLowerCase()} charge for ${dateDisplay} is ${formatRupees(amountDue)}. Please pay at your earliest convenience. - KeyHQ`,
		);
		window.open(
			`https://wa.me/${u.tenantPhone.replace(/\D/g, "")}?text=${message}`,
			"_blank",
		);
	}

	function handleEmail() {
		if (!u.tenantEmail) return;
		window.open(
			`mailto:${u.tenantEmail}?subject=${typeLabel} Charge - ${dateDisplay}&body=Dear ${u.tenantName ?? "Tenant"}, your ${typeLabel.toLowerCase()} charge is ${formatRupees(amountDue)}.`,
		);
	}

	return (
		// biome-ignore lint/a11y/useSemanticElements: a row cannot be a button because it contains its own actions
		<div
			role="button"
			tabIndex={0}
			className={`grid cursor-pointer grid-cols-2 gap-4 border-b px-4 py-4 transition-colors last:border-0 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-inset lg:grid-cols-[minmax(13rem,1.4fr)_minmax(9rem,1fr)_minmax(8rem,.8fr)_minmax(7rem,.7fr)_minmax(6rem,.55fr)_minmax(15rem,auto)] lg:items-center lg:px-5 ${isDeleting ? "pointer-events-none opacity-50" : ""}`}
			onClick={(event) => {
				if (!isUtilityRowActionTarget(event.target)) onViewDetail();
			}}
			onKeyDown={(event) => {
				if (event.key === "Enter" && !isUtilityRowActionTarget(event.target)) {
					onViewDetail();
				}
			}}
		>
			<div className="col-span-2 flex min-w-0 items-center gap-3 lg:col-span-1">
				<div
					className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
						isWater ? "bg-sky-50 text-sky-600" : "bg-violet-50 text-violet-600"
					}`}
				>
					{isWater ? (
						<IconDroplet className="size-5" />
					) : (
						<IconTool className="size-5" />
					)}
				</div>
				<div className="min-w-0">
					<p className="truncate font-semibold text-sm">
						{u.tenantName ?? "Tenant unavailable"}
					</p>
					<p className="truncate text-muted-foreground text-xs">
						{u.propertyName} · Unit {u.unitNumber}
					</p>
				</div>
			</div>

			<div>
				<CellLabel>Service date</CellLabel>
				<p className="font-medium text-sm">{dateDisplay}</p>
			</div>

			<div className="min-w-0 lg:text-center">
				<CellLabel>Charge</CellLabel>
				<p className="truncate font-semibold text-sm">{typeLabel}</p>
				<p className="truncate text-muted-foreground text-xs">
					{u.description?.trim() || "Flat utility charge"}
				</p>
			</div>

			<div className="lg:text-center">
				<CellLabel>Amount</CellLabel>
				<p className="font-bold text-sm tabular-nums">
					{formatRupees(amountDue)}
				</p>
				{hasDiscount ? (
					<p className="text-muted-foreground text-xs line-through">
						{formatRupees(u.totalAmount)}
					</p>
				) : null}
			</div>

			<div className="lg:justify-self-center">
				<CellLabel>Status</CellLabel>
				<Badge
					variant="secondary"
					className={
						isPaidDerived
							? "bg-emerald-50 text-emerald-700"
							: "bg-amber-50 text-amber-700"
					}
				>
					{isPaidDerived ? "Paid" : "Unpaid"}
				</Badge>
			</div>

			<div className="col-span-2 flex items-center justify-end gap-1 border-t pt-3 lg:col-span-1 lg:border-0 lg:pt-0">
				<Button
					variant="ghost"
					size="sm"
					data-utility-row-action
					onClick={() => window.open(documentAction.href, "_blank", "noopener")}
					title={documentAction.title}
				>
					<IconDownload className="size-3.5" />
					{documentAction.label}
				</Button>
				<Button
					variant="outline"
					size="sm"
					className="min-w-[5.75rem]"
					data-utility-row-action
					disabled={isPaidDerived}
					onClick={onMarkPaid}
				>
					<IconCheck className="size-3.5" />
					{isPaidDerived ? "Paid" : "Mark paid"}
				</Button>
				<UtilityRowMenu
					canEmail={Boolean(u.tenantEmail)}
					canWhatsApp={Boolean(u.tenantPhone)}
					isDeleting={isDeleting}
					onDelete={onDelete}
					onEdit={onEdit}
					onEmail={handleEmail}
					onWhatsApp={handleWhatsApp}
				/>
			</div>
		</div>
	);
}

function CellLabel({ children }: { children: React.ReactNode }) {
	return (
		<p className="mb-1 font-semibold text-[10px] text-muted-foreground uppercase tracking-wide lg:hidden">
			{children}
		</p>
	);
}
