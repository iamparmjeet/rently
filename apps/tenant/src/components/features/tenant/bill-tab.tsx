"use client";

import { useTenantLease, useTenantUtilities } from "@/hooks/tenant-portal";
import { fmtDate, fmtMonth, rupeesCompact } from "@/utils/format";

function latestByType<
	T extends {
		utilityType: string;
		currentReadingDate?: string | Date | null;
		createdAt?: string | Date | null;
	},
>(items: T[]): Record<string, T> {
	// Sort desc by currentReadingDate then createdAt so first per type is truly latest
	const sorted = [...items].sort((a, b) => {
		const aTime = new Date(
			(a.currentReadingDate ?? a.createdAt ?? 0) as string | number | Date,
		).getTime();
		const bTime = new Date(
			(b.currentReadingDate ?? b.createdAt ?? 0) as string | number | Date,
		).getTime();
		return bTime - aTime;
	});
	return sorted.reduce<Record<string, T>>((acc, u) => {
		if (!acc[u.utilityType]) acc[u.utilityType] = u;
		return acc;
	}, {});
}

export function BillTab() {
	const { data: leaseData, isLoading } = useTenantLease();
	const { data: utilitiesData } = useTenantUtilities();

	const lease = leaseData?.lease;
	const utilities = utilitiesData?.utilities ?? [];
	const latest = latestByType(utilities);

	const electricity = latest.electricity;
	const water = latest.water;
	const maintenance = latest.maintenance;

	const lineItems = [
		lease && {
			emoji: "🏠",
			label: "Monthly Rent",
			sub: `Unit ${lease.unit.unitNumber} · ${lease.property.name}`,
			amount: lease.rent,
		},
		electricity && {
			emoji: "⚡",
			label: "Electricity",
			sub:
				electricity.unitsUsed != null
					? `${electricity.unitsUsed} units × ₹${((electricity.ratePerUnit ?? 0) / 100).toFixed(0)}/unit · ${fmtDate(electricity.previousReadingDate)} → ${fmtDate(electricity.currentReadingDate)}`
					: fmtDate(electricity.currentReadingDate),
			amount: electricity.totalAmount,
		},
		water && {
			emoji: "💧",
			label: "Water Charges",
			sub: `${fmtMonth(water.currentReadingDate)} · Fixed charge`,
			amount: water.totalAmount,
		},
		maintenance && {
			emoji: "🔧",
			label: "Maintenance",
			sub: maintenance.description ?? fmtMonth(maintenance.currentReadingDate),
			amount: maintenance.totalAmount,
		},
	].filter(Boolean) as {
		emoji: string;
		label: string;
		sub: string;
		amount: number;
	}[];

	const totalDue = lineItems.reduce((s, i) => s + i.amount, 0);

	const currentMonth = new Date().toLocaleDateString("en-IN", {
		month: "long",
		year: "numeric",
	});

	if (isLoading) {
		return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
	}

	return (
		<div className="space-y-3.5">
			<h1 className="font-extrabold text-xl">Combined Bill — {currentMonth}</h1>

			<div className="overflow-hidden rounded-xl border bg-background">
				{lineItems.length === 0 ? (
					<div className="py-10 text-center text-muted-foreground text-sm">
						No charges for this period yet.
					</div>
				) : (
					<div className="divide-y divide-border">
						{lineItems.map((item) => (
							<div
								key={item.label}
								className="flex items-center gap-3 px-4 py-3.5"
							>
								<span className="w-8 text-center text-2xl">{item.emoji}</span>
								<div className="flex-1">
									<p className="font-semibold text-sm">{item.label}</p>
									<p className="mt-0.5 text-muted-foreground text-xs">
										{item.sub}
									</p>
								</div>
								<p className="font-bold">{rupeesCompact(item.amount)}</p>
							</div>
						))}
					</div>
				)}

				<div className="flex items-center justify-between bg-primary px-4 py-3.5">
					<span className="font-bold text-primary-foreground">Total Due</span>
					<span className="font-extrabold text-3xl text-primary-foreground">
						{rupeesCompact(totalDue)}
					</span>
				</div>
			</div>

			{/* Actions */}
			<div className="flex gap-2.5">
				<button
					type="button"
					onClick={() => {
						const msg = encodeURIComponent(
							`KeyHQ Bill — ${currentMonth}\n\n${lineItems
								.map((i) => `${i.emoji} ${i.label}: ${rupeesCompact(i.amount)}`)
								.join("\n")}\n\nTotal Due: ${rupeesCompact(totalDue)}`,
						);
						window.open(`https://wa.me/?text=${msg}`, "_blank");
					}}
					className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#25D366] bg-[#25D366] font-medium text-sm text-white transition-colors hover:bg-[#1ebe5d]"
				>
					Share on WhatsApp
				</button>
			</div>

			{/* Tip banner */}
			<div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3.5">
				<p className="font-semibold text-primary text-sm">
					💡 Tip: Pay early to avoid late fees
				</p>
				<p className="mt-1 text-muted-foreground text-xs">
					Payment is due by{" "}
					{fmtDate(
						new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
					)}
					. UPI, bank transfer, or cash accepted.
				</p>
			</div>
		</div>
	);
}
