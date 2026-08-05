import { Badge } from "@rently/ui/components/badge";
import { Button } from "@rently/ui/components/button";
import { formatRupees } from "@rently/ui/lib/currency";
import type { LeaseWithDetails, UtilityListItem } from "@rently/validators";
import { IconBrandWhatsapp, IconChevronRight } from "@tabler/icons-react";

export type CombinedBillGroup = {
	lease: LeaseWithDetails;
	utilities: UtilityListItem[];
	// Derived:
	electricityTotal: number; // paise
	waterTotal: number; // paise
	maintenanceTotal: number; // paise
	utilityTotal: number; // paise — sum of all utility totalAmounts
	grandTotal: number; // paise — rent + utilityTotal
	allPaid: boolean;
};

interface CombinedBillRowProps {
	group: CombinedBillGroup;
	onSendWhatsApp?: () => void;
}

export function CombinedBillRow({
	group,
	onSendWhatsApp,
}: CombinedBillRowProps) {
	const { lease, grandTotal, electricityTotal, waterTotal, maintenanceTotal } =
		group;

	// Initials for avatar
	const initials = (lease.tenantName ?? "?")
		.split(" ")
		.map((w) => w[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);

	const allPaid = group.utilities.every((u) => u.isPaid);
	const hasOverdue = group.utilities.some((u) => !u.isPaid);

	function handleWhatsApp() {
		if (!lease.tenantPhone) return;
		const msg = encodeURIComponent(
			[
				`Dear ${lease.tenantName ?? "Tenant"},`,
				"Your bill summary for this month:",
				`• Rent: ${formatRupees(lease.rent)}`,
				electricityTotal > 0
					? `• Electricity: ${formatRupees(electricityTotal)}`
					: null,
				waterTotal > 0 ? `• Water: ${formatRupees(waterTotal)}` : null,
				maintenanceTotal > 0
					? `• Maintenance: ${formatRupees(maintenanceTotal)}`
					: null,
				`Total: ${formatRupees(grandTotal)}`,
				"Please pay at your earliest convenience. - KeyHQ",
			]
				.filter(Boolean)
				.join("\n"),
		);
		window.open(
			`https://wa.me/${lease.tenantPhone.replace(/\D/g, "")}?text=${msg}`,
			"_blank",
		);
		onSendWhatsApp?.();
	}

	return (
		<div className="flex cursor-pointer items-center gap-4 border-b px-5 py-4 transition-colors last:border-0 hover:bg-muted/40">
			{/* Avatar */}
			<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-sm">
				{initials}
			</div>

			{/* Tenant + unit */}
			<div className="w-44 shrink-0">
				<p className="font-semibold text-sm">{lease.tenantName ?? "—"}</p>
				<p className="text-muted-foreground text-xs">
					{lease.propertyName} · Unit {lease.unitNumber}
				</p>
			</div>

			{/* Bill breakdown pills */}
			<div className="flex flex-1 flex-wrap items-center gap-3">
				{/* Always show rent */}
				<BillPill icon="🏠" label="Rent" amount={lease.rent} />

				{electricityTotal > 0 && (
					<BillPill icon="⚡" label="Electricity" amount={electricityTotal} />
				)}
				{waterTotal > 0 && (
					<BillPill icon="💧" label="Water" amount={waterTotal} />
				)}
				{maintenanceTotal > 0 && (
					<BillPill icon="🔧" label="Maintenance" amount={maintenanceTotal} />
				)}
			</div>

			{/* Total + status */}
			<div className="shrink-0 text-right">
				<p className="font-bold text-base">{formatRupees(grandTotal)}</p>
				<p className="text-[10px] text-muted-foreground">total</p>
			</div>

			<Badge
				variant={allPaid ? "default" : hasOverdue ? "destructive" : "secondary"}
				className="shrink-0 text-xs"
			>
				{allPaid ? "Paid" : hasOverdue ? "Overdue" : "Pending"}
			</Badge>

			{/* WhatsApp send */}
			<Button
				size="sm"
				variant="ghost"
				className="h-8 shrink-0 gap-1.5 bg-green-50 px-2.5 text-green-700 text-xs hover:bg-green-100"
				onClick={(e) => {
					e.stopPropagation();
					handleWhatsApp();
				}}
				disabled={!lease.tenantPhone}
				title="Send combined bill via WhatsApp"
			>
				<IconBrandWhatsapp className="size-4" />
				Send Bill
			</Button>

			<IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
		</div>
	);
}

function BillPill({
	icon,
	label,
	amount,
}: {
	icon: string;
	label: string;
	amount: number;
}) {
	return (
		<div className="flex items-center gap-1 rounded-md bg-muted px-2 py-1">
			<span className="text-xs">{icon}</span>
			<span className="text-muted-foreground text-xs">{label}</span>
			<span className="font-semibold text-xs">{formatRupees(amount)}</span>
		</div>
	);
}
