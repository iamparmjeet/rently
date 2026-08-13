import { Badge } from "@rently/ui/components/badge";
import { Button } from "@rently/ui/components/button";
import { formatRupees } from "@rently/ui/lib/currency";
import type { LeaseWithDetails, UtilityListItem } from "@rently/validators";
import { IconBrandWhatsapp, IconChevronRight } from "@tabler/icons-react";

export type CombinedBillGroup = {
	id: string;
	period: Date;
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
	onViewDetail: () => void;
	onSendWhatsApp?: () => void;
}

export function CombinedBillRow({
	group,
	onViewDetail,
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
	const periodLabel = group.period.toLocaleDateString("en-IN", {
		month: "long",
		year: "numeric",
	});

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
		// biome-ignore lint/a11y/useSemanticElements: this summary contains a nested WhatsApp action
		<div
			role="button"
			tabIndex={0}
			onClick={onViewDetail}
			onKeyDown={(event) => {
				if (event.key === "Enter" && event.target === event.currentTarget) {
					onViewDetail();
				}
			}}
			className="grid cursor-pointer gap-4 border-b px-4 py-4 transition-colors last:border-0 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-inset lg:grid-cols-[minmax(15rem,1fr)_minmax(22rem,1.4fr)_minmax(16rem,.8fr)] lg:items-center lg:px-5"
		>
			<div className="flex min-w-0 items-center gap-3">
				<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary text-sm">
					{initials}
				</div>
				<div className="min-w-0">
					<p className="font-semibold text-sm">{lease.tenantName ?? "—"}</p>
					<p className="truncate text-muted-foreground text-xs">
						{lease.propertyName} · Unit {lease.unitNumber}
					</p>
					<p className="mt-1 text-[11px] text-muted-foreground">
						{periodLabel}
					</p>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-x-6 gap-y-2 border-y py-3 sm:grid-cols-4 lg:border-y-0 lg:py-0">
				<BillAmount label="Rent" amount={lease.rent} />
				{electricityTotal > 0 && (
					<BillAmount label="Electricity" amount={electricityTotal} />
				)}
				{waterTotal > 0 && <BillAmount label="Water" amount={waterTotal} />}
				{maintenanceTotal > 0 && (
					<BillAmount label="Maintenance" amount={maintenanceTotal} />
				)}
			</div>

			<div className="flex items-center justify-between gap-3 lg:justify-end">
				<div className="text-right">
					<p className="font-bold text-base tabular-nums">
						{formatRupees(grandTotal)}
					</p>
					<div className="mt-0.5 flex items-center justify-end gap-1.5">
						<span className="text-[10px] text-muted-foreground">Total</span>
						<Badge
							variant="secondary"
							className={
								allPaid
									? "bg-emerald-50 text-emerald-700"
									: "bg-amber-50 text-amber-700"
							}
						>
							{allPaid ? "Paid" : "Pending"}
						</Badge>
					</div>
				</div>
				<Button
					size="sm"
					variant="outline"
					className="h-8 shrink-0 gap-1.5 px-2.5 text-xs"
					data-utility-row-action
					onClick={(e) => {
						e.stopPropagation();
						handleWhatsApp();
					}}
					disabled={!lease.tenantPhone}
					title="Send combined bill via WhatsApp"
				>
					<IconBrandWhatsapp className="size-4 text-green-600" />
					Send bill
				</Button>
				<IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
			</div>
		</div>
	);
}

function BillAmount({ label, amount }: { label: string; amount: number }) {
	return (
		<div className="min-w-0">
			<p className="truncate text-[10px] text-muted-foreground uppercase tracking-wide">
				{label}
			</p>
			<p className="mt-0.5 font-semibold text-sm tabular-nums">
				{formatRupees(amount)}
			</p>
		</div>
	);
}
