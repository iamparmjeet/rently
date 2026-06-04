import { Badge } from "@rently/ui/components/badge";
import { Button } from "@rently/ui/components/button";
import { formatFormRupees } from "@rently/ui/lib/currency";
import { ConfirmDialog } from "@rently/ui/shared/confirm-dialog";
import type { UtilityListItem } from "@rently/validators";
import {
	IconBrandWhatsapp,
	IconCheck,
	IconDroplet,
	IconEdit,
	IconMail,
	IconTool,
	IconTrash,
} from "@tabler/icons-react";

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
	const isMaintenance = u.utilityType === "maintenance";

	const dateDisplay = u.currentReadingDate
		? new Date(u.currentReadingDate).toLocaleDateString("en-IN", {
				day: "2-digit",
				month: "short",
				year: "numeric",
			})
		: "—";

	function handleWhatsApp() {
		if (!u.tenantPhone) return;
		const typeLabel = isWater ? "water charges" : "maintenance charge";
		const msg = encodeURIComponent(
			`Dear ${u.tenantName ?? "Tenant"}, your ${typeLabel} for ${dateDisplay} is ${formatFormRupees(u.totalAmount)}. Please pay at your earliest convenience. - RentWise`,
		);
		window.open(
			`https://wa.me/${u.tenantPhone.replace(/\D/g, "")}?text=${msg}`,
			"_blank",
		);
	}

	function handleEmail() {
		if (!u.tenantEmail) return;
		const typeLabel = isWater ? "Water Bill" : "Maintenance Charge";
		window.open(
			`mailto:${u.tenantEmail}?subject=${typeLabel} - ${dateDisplay}&body=Dear ${u.tenantName ?? "Tenant"}, your ${typeLabel.toLowerCase()} is ${formatFormRupees(u.totalAmount)}.`,
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
			<div
				className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
					isWater ? "bg-sky-50 text-sky-600" : "bg-violet-50 text-violet-600"
				}`}
			>
				{isWater ? (
					<IconDroplet className="size-5" />
				) : (
					<IconTool className="size-5" />
				)}
			</div>

			{/* Tenant + property (or description for maintenance) */}
			<div className="w-52 shrink-0">
				<p className="font-semibold text-sm">
					{isMaintenance
						? (u.description ?? "Maintenance")
						: (u.tenantName ?? "—")}
				</p>
				<p className="text-muted-foreground text-xs">
					{u.propertyName} · Unit {u.unitNumber}
					{isMaintenance && u.tenantName ? ` · ${u.tenantName}` : ""}
				</p>
			</div>

			{/* Details */}
			<div className="flex flex-1 items-center gap-6">
				<div className="min-w-25">
					<p className="font-medium text-[10px] text-muted-foreground">Date</p>
					<p className="mt-0.5 text-sm">{dateDisplay}</p>
				</div>

				{isWater && (
					<div className="min-w-25">
						<p className="font-medium text-[10px] text-muted-foreground">
							Charge Type
						</p>
						<p className="mt-0.5 text-sm">Flat per unit</p>
					</div>
				)}

				{isMaintenance && u.description && (
					<div className="flex-1">
						<p className="font-medium text-[10px] text-muted-foreground">
							Description
						</p>
						<p className="mt-0.5 line-clamp-1 text-sm">{u.description}</p>
					</div>
				)}

				<div className="min-w-25">
					<p className="font-medium text-[10px] text-muted-foreground">
						Amount
					</p>
					<p className="mt-0.5 font-bold text-green-600 text-sm">
						{formatFormRupees(u.totalAmount)}
					</p>
				</div>
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
				title="Delete charge?"
				description="This charge record will be permanently deleted."
				onConfirm={onDelete}
				trigger={<IconTrash className="size-4 text-destructive" />}
			/>
		</div>
	);
}
