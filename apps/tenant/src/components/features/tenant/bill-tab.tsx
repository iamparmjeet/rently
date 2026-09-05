"use client";

import { useTenantAgreements, useTenantUtilities } from "@/hooks/tenant-portal";
import { fmtDate, rupeesCompact } from "@/utils/format";

export function BillTab() {
	const { data: agreementsData, isLoading: agreementsLoading } =
		useTenantAgreements();
	const { data: utilitiesData, isLoading: utilitiesLoading } =
		useTenantUtilities();

	const agreements = agreementsData?.agreements ?? [];
	const utilities = utilitiesData?.utilities ?? [];
	const activeUnits = agreements.flatMap((agreement) =>
		agreement.units
			.filter((unit) => unit.status === "active")
			.map((unit) => ({ ...unit, agreement })),
	);
	const unitByLeaseId = new Map(
		activeUnits.map((unit) => [unit.leaseId, unit]),
	);
	const now = new Date();
	const currentUtilities = utilities.filter((utility) => {
		const billDate = new Date(utility.currentReadingDate ?? utility.createdAt);
		return (
			unitByLeaseId.has(utility.leaseId) &&
			utility.amountDue > 0 &&
			billDate.getMonth() === now.getMonth() &&
			billDate.getFullYear() === now.getFullYear()
		);
	});
	const lineItems: {
		id: string;
		emoji: string;
		label: string;
		sub: string;
		amount: number;
	}[] = [
		...activeUnits.map((unit) => ({
			id: `rent-${unit.leaseId}`,
			emoji: "🏠",
			label: "Monthly Rent",
			sub: `Unit ${unit.unitNumber} · ${unit.agreement.property.name}`,
			amount: unit.rent,
		})),
		...currentUtilities.map((utility) => {
			const unit = unitByLeaseId.get(utility.leaseId);
			const utilityName =
				utility.utilityType.charAt(0).toUpperCase() +
				utility.utilityType.slice(1);
			return {
				id: utility.id,
				emoji:
					{ electricity: "⚡", water: "💧", maintenance: "🔧" }[
						utility.utilityType
					] ?? "📄",
				label: utilityName,
				sub: unit
					? `Unit ${unit.unitNumber} · ${unit.agreement.property.name}`
					: fmtDate(utility.currentReadingDate),
				amount: utility.amountDue,
			};
		}),
	];

	const totalDue = lineItems.reduce((s, i) => s + i.amount, 0);

	const currentMonth = now.toLocaleDateString("en-IN", {
		month: "long",
		year: "numeric",
	});

	if (agreementsLoading || utilitiesLoading) {
		return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
	}

	return (
		<div className="space-y-3.5">
			<h1 className="font-extrabold text-xl">My Charges — {currentMonth}</h1>

			<div className="overflow-hidden rounded-xl border bg-background">
				{lineItems.length === 0 ? (
					<div className="py-10 text-center text-muted-foreground text-sm">
						No charges for this period yet.
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
						Total Charges
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
							`KeyHQ Bill — ${currentMonth}\n\n${lineItems
								.map((i) => `${i.emoji} ${i.label}: ${rupeesCompact(i.amount)}`)
								.join("\n")}\n\nTotal Charges: ${rupeesCompact(totalDue)}`,
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
