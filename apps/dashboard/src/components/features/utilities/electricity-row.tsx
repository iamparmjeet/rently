import { Badge } from "@rently/ui/components/badge";
import { Button } from "@rently/ui/components/button";
import { formatRupees } from "@rently/ui/lib/currency";
import type { UtilityListItem } from "@rently/validators";
import { IconBolt, IconCheck, IconDownload } from "@tabler/icons-react";
import {
	getUtilityDocumentAction,
	isUtilityRowActionTarget,
} from "./utility-row-actions";
import { UtilityRowMenu } from "./utility-row-menu";

interface ElectricityRowProps {
	utility: UtilityListItem;
	onEdit: () => void;
	onDelete: () => void;
	onMarkPaid: () => void;
	onViewDetail: () => void;
	isDeleting: boolean;
}

function formatDate(value: Date | null) {
	if (!value) return "—";
	return new Date(value).toLocaleDateString("en-IN", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
}

export function ElectricityRow({
	isDeleting,
	onDelete,
	onEdit,
	onMarkPaid,
	onViewDetail,
	utility: u,
}: ElectricityRowProps) {
	const previous = Number(u.previousReading ?? 0);
	const current = Number(u.currentReading ?? 0);
	const consumed = Number(u.unitsUsed ?? current - previous);
	const documentAction = getUtilityDocumentAction({
		utilityId: u.id,
		receiptPaymentId: u.receiptPaymentId,
	});

	function handleWhatsApp() {
		if (!u.tenantPhone) return;
		const message = encodeURIComponent(
			`Dear ${u.tenantName ?? "Tenant"}, your electricity bill for ${formatDate(u.currentReadingDate)} is ${formatRupees(u.totalAmount)}. Please pay at your earliest convenience. - KeyHQ`,
		);
		window.open(
			`https://wa.me/${u.tenantPhone.replace(/\D/g, "")}?text=${message}`,
			"_blank",
		);
	}

	function handleEmail() {
		if (!u.tenantEmail) return;
		window.open(
			`mailto:${u.tenantEmail}?subject=Electricity Bill - ${formatDate(u.currentReadingDate)}&body=Dear ${u.tenantName ?? "Tenant"}, your electricity bill is ${formatRupees(u.totalAmount)}.`,
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
				<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
					<IconBolt className="size-5" />
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
				<CellLabel>Service period</CellLabel>
				<p className="font-medium text-sm">
					{formatDate(u.previousReadingDate)} –{" "}
					{formatDate(u.currentReadingDate)}
				</p>
			</div>

			<div className="lg:text-center">
				<CellLabel>Usage</CellLabel>
				<p className="font-semibold text-sm">{consumed.toFixed(1)} kWh</p>
				<p className="text-muted-foreground text-xs tabular-nums">
					{previous.toFixed(1)} → {current.toFixed(1)}
				</p>
			</div>

			<div className="lg:text-center">
				<CellLabel>Amount</CellLabel>
				<p className="font-bold text-sm tabular-nums">
					{formatRupees(u.totalAmount)}
				</p>
			</div>

			<div className="lg:justify-self-center">
				<CellLabel>Status</CellLabel>
				<Badge
					variant="secondary"
					className={
						u.isPaid
							? "bg-emerald-50 text-emerald-700"
							: "bg-amber-50 text-amber-700"
					}
				>
					{u.isPaid ? "Paid" : "Unpaid"}
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
					disabled={u.isPaid}
					onClick={onMarkPaid}
				>
					<IconCheck className="size-3.5" />
					{u.isPaid ? "Paid" : "Mark paid"}
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
