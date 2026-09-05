"use client";

import { Badge } from "@rently/ui/components/badge";
import { Button } from "@rently/ui/components/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import { formatRupees } from "@rently/ui/lib/currency";
import { cn } from "@rently/ui/lib/utils";
import { IconChevronRight } from "@tabler/icons-react";
import type { CombinedBillGroup } from "./combined-bill-row";

interface CombinedBillCardProps {
	group: CombinedBillGroup;
	onViewDetail: () => void;
}

export function CombinedBillCard({
	group,
	onViewDetail,
}: CombinedBillCardProps) {
	const {
		lease,
		grandTotal,
		rentDue,
		electricityTotal,
		waterTotal,
		maintenanceTotal,
	} = group;

	const initials = (lease.tenantName ?? "?")
		.split(" ")
		.map((w) => w[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);

	const allPaid = group.allPaid;
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
				`• Rent: ${formatRupees(rentDue)}`,
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
	}

	return (
		<Card
			className={cn(
				"gap-0 overflow-hidden border-border/80 py-0 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md",
			)}
		>
			<CardHeader className="relative border-b bg-gradient-to-br from-primary/[0.12] via-primary/[0.03] to-transparent px-5 pt-5 pb-4">
				<div className="flex items-start justify-between">
					<div className="flex min-w-0 items-start gap-3">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary text-sm">
							{initials}
						</div>
						<CardTitle className="min-w-0 pt-0.5">
							<p className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
								{periodLabel}
							</p>
							<p className="truncate font-semibold text-base">
								{lease.tenantName ?? "—"}
							</p>
							<p className="mt-1 line-clamp-1 text-muted-foreground text-xs">
								{lease.propertyName} · Unit {lease.unitNumber}
							</p>
						</CardTitle>
					</div>
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
			</CardHeader>

			<CardContent className="space-y-2.5 bg-card px-5 py-4">
				<BillLine label="Rent" amount={rentDue} />
				{electricityTotal > 0 && (
					<BillLine label="Electricity" amount={electricityTotal} />
				)}
				{waterTotal > 0 && <BillLine label="Water" amount={waterTotal} />}
				{maintenanceTotal > 0 && (
					<BillLine label="Maintenance" amount={maintenanceTotal} />
				)}
				<div className="my-0.5 border-t" />
				<div className="flex items-baseline justify-between">
					<p className="font-semibold text-sm">Grand Total</p>
					<p className="font-bold text-lg tabular-nums tracking-tight">
						{formatRupees(grandTotal)}
					</p>
				</div>
			</CardContent>

			<CardFooter className="flex items-center justify-between gap-3 border-t px-5 py-3.5">
				{lease.tenantPhone ? (
					<Button
						variant="outline"
						size="sm"
						className="h-8 gap-1.5 text-xs"
						onClick={(e) => {
							e.stopPropagation();
							handleWhatsApp();
						}}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="currentColor"
							className="size-4 text-green-600"
						>
							<title>WhatsApp</title>
							<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52s-.67-1.612-.918-2.207c-.242-.579-.487-.5-.67-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 0 0-3.48-8.413z" />
						</svg>
						Send bill
					</Button>
				) : (
					<span />
				)}
				<Button
					variant="ghost"
					size="sm"
					className="text-primary"
					onClick={(e) => {
						e.stopPropagation();
						onViewDetail();
					}}
				>
					View details
					<IconChevronRight className="size-3.5" />
				</Button>
			</CardFooter>
		</Card>
	);
}

function BillLine({ label, amount }: { label: string; amount: number }) {
	return (
		<div className="flex items-baseline justify-between">
			<p className="text-muted-foreground text-xs">{label}</p>
			<p className="font-medium text-sm tabular-nums">{formatRupees(amount)}</p>
		</div>
	);
}
