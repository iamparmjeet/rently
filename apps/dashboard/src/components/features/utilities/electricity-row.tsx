import { Badge } from "@rently/ui/components/badge";
import { Button } from "@rently/ui/components/button";
import { formatRupees } from "@rently/ui/lib/currency";
import { ConfirmDialog } from "@rently/ui/shared/confirm-dialog";
import type { UtilityListItem } from "@rently/validators";
import {
	IconBolt,
	IconBrandWhatsapp,
	IconCheck,
	IconEdit,
	IconMail,
	IconTrash,
} from "@tabler/icons-react";

interface ElectricityRowProps {
	utility: UtilityListItem;
	onEdit: () => void;
	onDelete: () => void;
	onMarkPaid: () => void;
	onViewDetail: () => void;
	isDeleting: boolean;
}

export function ElectricityRow({
	isDeleting,
	onDelete,
	onEdit,
	onMarkPaid,
	onViewDetail,
	utility: u,
}: ElectricityRowProps) {
	const prevDate = u.previousReadingDate
		? new Date(u.previousReadingDate).toLocaleDateString("en-IN", {
				day: "2-digit",
				month: "short",
				year: "2-digit",
			})
		: "-";

	const currDate = u.currentReadingDate
		? new Date(u.currentReadingDate).toLocaleDateString("en-IN", {
				day: "2-digit",
				month: "short",
				year: "numeric",
			})
		: "—";

	const prev = Number(u.previousReading ?? 0);
	const curr = Number(u.currentReading ?? 0);
	const consumed = Number(u.unitsUsed ?? curr - prev);

	// Money conversion
	const rateDisplay = u.ratePerUnit ? formatRupees(u.ratePerUnit) : "₹0.09";

	function handleWhatsApp() {
		if (!u.tenantPhone) return;
		const msg = encodeURIComponent(
			`Dear ${u.tenantName ?? "Tenant"}, your electricity bill for ${currDate} is ${formatRupees(u.totalAmount)} (${consumed.toFixed(1)} kWh × ${rateDisplay}/unit). Please pay at your earliest convenience. - RentWise`,
		);
		window.open(
			`https://wa.me/${u.tenantPhone.replace(/\D/g, "")}?text=${msg}`,
			"_blank",
		);
	}
	function handleEmail() {
		if (!u.tenantEmail) return;
		window.open(
			`mailto:${u.tenantEmail}?subject=Electricity Bill - ${currDate}&body=Dear ${u.tenantName ?? "Tenant"}, your electricity bill is ${formatRupees(u.totalAmount)}.`,
		);
	}
	return (
		// biome-ignore lint/a11y/useSemanticElements: row contains interactive action buttons — <button> nesting is invalid HTML
		<div
			role="button"
			tabIndex={0}
			className={`flex cursor-pointer items-center gap-4 border-b px-5 py-4 transition-colors last:border-0 hover:bg-muted/40 ${isDeleting ? "pointer-events-none opacity-50" : ""}`}
			onClick={onViewDetail}
			onKeyDown={(e) => e.key === "Enter" && onViewDetail()}
		>
			{/* Icon */}
			<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
				<IconBolt className="size-5" />
			</div>

			{/* Tenant + property */}
			<div className="w-44 shrink-0">
				<p className="font-semibold text-sm">{u.tenantName ?? "—"}</p>
				<p className="text-muted-foreground text-xs">
					{u.propertyName} · Unit {u.unitNumber}
				</p>
			</div>

			{/* Reading values */}
			<div className="flex flex-1 items-center gap-6 overflow-x-auto">
				<ReadingVal label={`Prev (${prevDate})`} value={`${prev} kWh`} />
				<ReadingVal label={`Curr (${currDate})`} value={`${curr} kWh`} />
				<ReadingVal
					label="Units Used"
					value={`${consumed.toFixed(1)} kWh`}
					highlight="blue"
				/>
				<ReadingVal
					label={`Bill (${rateDisplay}/kWh)`}
					value={formatRupees(u.totalAmount)}
					highlight="green"
				/>
			</div>

			{/* Status + actions */}

			<Badge variant={u.isPaid ? "default" : "secondary"} className="text-xs">
				{u.isPaid ? "Billed" : "Unpaid"}
			</Badge>

			{/* WhatsApp */}
			<Button
				size="sm"
				variant="ghost"
				className="h-8 gap-1.5 bg-green-50 px-2.5 text-green-700 text-xs hover:bg-green-100 hover:text-green-800"
				onClick={handleWhatsApp}
				disabled={!u.tenantPhone}
				title={u.tenantPhone ? "Send via WhatsApp" : "No phone number"}
			>
				{/* Simple WA icon inline */}
				<IconBrandWhatsapp className="size-4" />
				WA
			</Button>

			{/* Email */}
			<Button
				size="sm"
				variant="ghost"
				className="h-8 gap-1.5 bg-blue-50 px-2.5 text-blue-700 text-xs hover:bg-blue-100"
				onClick={handleEmail}
				disabled={!u.tenantEmail}
				title={u.tenantEmail ? "Send via email" : "No email"}
			>
				<IconMail className="size-3.5" />
				Email
			</Button>

			{/* Mark paid */}
			{!u.isPaid && (
				<Button
					size="icon"
					variant="ghost"
					className="size-8"
					onClick={onMarkPaid}
					title="Mark as paid"
				>
					<IconCheck className="size-4" />
				</Button>
			)}

			{/* Edit */}
			<Button size="icon" variant="ghost" className="size-8" onClick={onEdit}>
				<IconEdit className="size-4" />
			</Button>

			{/* Delete */}
			<ConfirmDialog
				title="Delete reading?"
				description="This meter reading and its bill will be permanently deleted."
				onConfirm={onDelete}
				trigger={
					<Button size="icon" variant="ghost" className="size-8">
						<IconTrash className="size-4 text-destructive" />
					</Button>
				}
			/>
		</div>
	);
}

// ── Small helper inside this file — not exported ──────────────────────────────
function ReadingVal({
	label,
	value,
	highlight,
}: {
	label: string;
	value: string;
	highlight?: "blue" | "green";
}) {
	return (
		<div className="min-w-20">
			<p className="font-medium text-[10px] text-muted-foreground">{label}</p>
			<p
				className={`mt-0.5 font-bold text-sm ${
					highlight === "blue"
						? "text-blue-600"
						: highlight === "green"
							? "text-green-600"
							: ""
				}`}
			>
				{value}
			</p>
		</div>
	);
}
