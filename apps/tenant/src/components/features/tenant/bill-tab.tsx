"use client";

import { useMemo } from "react";
import { useTenantAgreements, useTenantUtilities } from "@/hooks/tenant-portal";
import { useTenantBalance } from "@/hooks/tenant-portal/use-tenant-balance";
import {
	activeUnits,
	type BillUnit,
	balanceByLeaseId,
	buildRentLines,
	buildUtilityLines,
	currentDueDate,
	summarizeLines,
} from "@/lib/bill-lines";
import { fmtDate, nextRentDueDate, rupeesCompact } from "@/utils/format";

// C07: the bill is built from the period balance read model — rent lines
// show the current period's outstanding and older arrears separately (never
// the full contract rent), and unpaid utilities of any age are listed.
export function BillTab() {
	const { data: agreementsData, isLoading: agreementsLoading } =
		useTenantAgreements();
	const { data: utilitiesData, isLoading: utilitiesLoading } =
		useTenantUtilities();
	const { data: balanceData, isLoading: balanceLoading } = useTenantBalance();

	const agreements = agreementsData?.agreements ?? [];
	const utilities = utilitiesData?.utilities ?? [];

	const units = useMemo(
		(): BillUnit[] =>
			activeUnits(
				agreements.flatMap((agreement) =>
					agreement.units.map((unit) => ({
						leaseId: unit.leaseId,
						unitNumber: unit.unitNumber,
						status: unit.status,
						propertyName: agreement.property.name,
					})),
				),
			),
		[agreements],
	);

	const balanceByLease = useMemo(
		() => balanceByLeaseId(balanceData?.leases),
		[balanceData?.leases],
	);

	const lineItems = useMemo(
		() => [
			...buildRentLines(units, balanceByLease),
			...buildUtilityLines(units, utilities),
		],
		[units, balanceByLease, utilities],
	);

	const totalDue = summarizeLines(lineItems);
	const dueDate = currentDueDate(units, balanceByLease) ?? nextRentDueDate();

	if (agreementsLoading || utilitiesLoading || balanceLoading) {
		return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
	}

	return (
		<div className="space-y-3.5">
			<h1 className="font-extrabold text-xl">My Charges — Outstanding</h1>

			<div className="overflow-hidden rounded-xl border bg-background">
				{lineItems.length === 0 ? (
					<div className="py-10 text-center text-muted-foreground text-sm">
						No outstanding charges. You&apos;re all caught up!
					</div>
				) : (
					<div className="divide-y divide-border">
						{lineItems.map((item) => (
							<div
								key={item.id}
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
					<span className="font-bold text-primary-foreground">
						Total Outstanding
					</span>
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
							`KeyHQ Bill\n\n${lineItems
								.map((i) => `${i.emoji} ${i.label}: ${rupeesCompact(i.amount)}`)
								.join("\n")}\n\nTotal Outstanding: ${rupeesCompact(totalDue)}`,
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
					Payment is due by {fmtDate(dueDate)}. UPI, bank transfer, or cash
					accepted.
				</p>
			</div>
		</div>
	);
}
