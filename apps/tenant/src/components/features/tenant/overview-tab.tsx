"use client";

import { cn } from "@rently/ui/lib/utils";
import {
	IconBolt,
	IconFileText,
	IconMessageCircle,
	IconTool,
} from "@tabler/icons-react";
import {
	useTenantAgreements,
	useTenantLease,
	useTenantPayments,
	useTenantUtilities,
} from "@/hooks/tenant-portal";
import { fmtDate, nextRentDueDate, rupeesCompact } from "@/utils/format";
import type { TenantPortalTab } from "./tenant-dashboard";

interface OverviewTabProps {
	onTabChange: (tab: TenantPortalTab) => void;
}

export function OverviewTab({ onTabChange }: OverviewTabProps) {
	const { data: leaseData, isLoading: leaseLoading } = useTenantLease();
	const { data: agreementsData, isLoading: agreementsLoading } =
		useTenantAgreements();
	const { data: paymentsData, isLoading: paymentsLoading } =
		useTenantPayments();
	const { data: utilitiesData, isLoading: utilitiesLoading } =
		useTenantUtilities();

	const lease = leaseData?.lease;
	const agreements = agreementsData?.agreements ?? [];
	const payments = paymentsData?.payments ?? [];
	const utilities = utilitiesData?.utilities ?? [];

	const ytdPaid = payments
		.filter((p) => p.amount > 0 && p.type !== "reversal")
		.reduce((s, p) => s + p.amount, 0);

	if (
		leaseLoading ||
		agreementsLoading ||
		paymentsLoading ||
		utilitiesLoading
	) {
		return <OverviewSkeleton />;
	}

	if (!lease) {
		return (
			<div className="flex flex-col items-center gap-3 py-16 text-center">
				<div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
					<IconFileText className="h-7 w-7 text-muted-foreground" />
				</div>
				<div>
					<p className="font-semibold">No Active Lease</p>
					<p className="mt-1 text-muted-foreground text-sm">
						Contact your landlord if you believe this is an error.
					</p>
				</div>
			</div>
		);
	}

	const activeAgreements = agreements.filter((agreement) =>
		agreement.units.some((unit) => unit.status === "active"),
	);
	const activeUnits = activeAgreements.flatMap((agreement) =>
		agreement.units
			.filter((unit) => unit.status === "active")
			.map((unit) => ({ ...unit, agreement })),
	);
	const activeUnitCount = activeUnits.length;
	const activeLeaseIds = new Set(activeUnits.map((unit) => unit.leaseId));
	const monthlyRent = activeUnits.reduce((total, unit) => total + unit.rent, 0);
	const now = new Date();
	const currentUtilities = utilities.filter((utility) => {
		const billDate = new Date(utility.currentReadingDate ?? utility.createdAt);
		return (
			activeLeaseIds.has(utility.leaseId) &&
			utility.amountDue > 0 &&
			billDate.getMonth() === now.getMonth() &&
			billDate.getFullYear() === now.getFullYear()
		);
	});
	const utilityDue = currentUtilities.reduce(
		(total, utility) => total + utility.amountDue,
		0,
	);
	const totalDue = monthlyRent + utilityDue;
	const unitByLeaseId = new Map(
		activeUnits.map((unit) => [unit.leaseId, unit]),
	);

	const currentMonth = now.toLocaleDateString("en-IN", {
		month: "long",
		year: "numeric",
	});

	return (
		<div className="space-y-3.5">
			{activeAgreements.length > 0 && (
				<div className="rounded-xl border bg-background p-4">
					<div className="flex items-center justify-between gap-3">
						<p className="font-bold text-sm">Active leases</p>
						<span className="rounded-full bg-primary/10 px-2 py-1 font-medium text-primary text-xs">
							{activeUnitCount} {activeUnitCount === 1 ? "unit" : "units"}
						</span>
					</div>
					<div className="mt-3 space-y-2">
						{activeUnits.map(({ agreement, ...unit }) => (
							<div
								key={unit.leaseId}
								className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 text-sm"
							>
								<div className="min-w-0">
									<p className="font-medium">Unit {unit.unitNumber}</p>
									<p className="truncate text-muted-foreground text-xs">
										{agreement.property.name} · {agreement.owner.name}
									</p>
								</div>
								<span className="shrink-0 font-semibold">
									{rupeesCompact(unit.rent)}
								</span>
							</div>
						))}
					</div>
				</div>
			)}
			{/* ── Stats grid ─────────────────────────────────────── */}
			<div className="grid grid-cols-2 gap-2.5">
				{/* Primary tile — full-width on small, half on larger */}
				<div className="col-span-2 rounded-xl bg-primary p-4 text-primary-foreground">
					<p className="font-medium text-primary-foreground/75 text-xs">
						This Month&apos;s Charges
					</p>
					<p className="mt-1 font-extrabold text-3xl leading-none">
						{rupeesCompact(totalDue)}
					</p>
					<p className="mt-1 text-primary-foreground/60 text-xs">
						Rent + unpaid utilities · Due by {fmtDate(nextRentDueDate())}
					</p>
				</div>

				<StatTile
					label="Total Paid (YTD)"
					value={rupeesCompact(ytdPaid)}
					sub="All transactions"
				/>
				<StatTile
					label="Monthly Rent"
					value={rupeesCompact(monthlyRent)}
					sub={`${activeUnitCount} active ${activeUnitCount === 1 ? "unit" : "units"}`}
				/>
				<StatTile
					label={activeUnitCount === 1 ? "Current Unit" : "Current Units"}
					value={`${activeUnitCount} ${activeUnitCount === 1 ? "unit" : "units"}`}
					sub="See active leases above"
				/>
				<StatTile
					label="Lease Status"
					value="Active"
					sub={`${activeUnitCount} active ${activeUnitCount === 1 ? "lease" : "leases"}`}
				/>
			</div>

			{/* ── Bill preview ───────────────────────────────────── */}
			<div className="overflow-hidden rounded-xl border bg-background">
				<div className="px-4 py-3">
					<p className="font-bold text-sm">Charge Preview — {currentMonth}</p>
					<p className="text-muted-foreground text-xs">All active units</p>
				</div>
				<div className="divide-y divide-border">
					{activeUnits.map((unit) => (
						<BillPreviewItem
							key={unit.leaseId}
							emoji="🏠"
							label={`Monthly Rent · Unit ${unit.unitNumber}`}
							sub={unit.agreement.property.name}
							amount={unit.rent}
						/>
					))}
					{currentUtilities.map((utility) => {
						const unit = unitByLeaseId.get(utility.leaseId);
						const label = `${utility.utilityType.charAt(0).toUpperCase()}${utility.utilityType.slice(1)}`;
						return (
							<BillPreviewItem
								key={utility.id}
								emoji="⚡"
								label={label}
								sub={
									unit
										? `Unit ${unit.unitNumber} · ${unit.agreement.property.name}`
										: undefined
								}
								amount={utility.amountDue}
							/>
						);
					})}
				</div>
				<div className="flex items-center justify-between bg-primary px-4 py-3">
					<span className="font-bold text-primary-foreground text-sm">
						Total Charges
					</span>
					<span className="font-extrabold text-2xl text-primary-foreground">
						{rupeesCompact(totalDue)}
					</span>
				</div>
			</div>

			{/* ── Quick actions ──────────────────────────────────── */}
			<div className="rounded-xl border bg-background p-4">
				<p className="mb-3 font-bold text-sm">Quick Actions</p>
				<div className="grid grid-cols-2 gap-2.5">
					<ActionButton
						icon={<IconBolt className="h-4 w-4" />}
						label="Add Reading"
						primary
						onClick={() => onTabChange("reading")}
					/>
					<ActionButton
						icon={<IconTool className="h-4 w-4" />}
						label="Raise Request"
						onClick={() => onTabChange("docs")}
					/>
					<ActionButton
						icon={<IconMessageCircle className="h-4 w-4" />}
						label="Share Message"
						whatsapp
						onClick={() => {
							const msg = encodeURIComponent(
								`Hi, I have a question about my ${activeUnitCount === 1 ? "lease" : "leases"}.`,
							);
							window.open(`https://wa.me/?text=${msg}`, "_blank");
						}}
					/>
					<ActionButton
						icon={<IconFileText className="h-4 w-4" />}
						label="Payment History"
						onClick={() => onTabChange("payments")}
					/>
				</div>
			</div>

			{/* ── Upcoming ───────────────────────────────────────── */}
			<div className="rounded-xl border bg-background p-4">
				<p className="mb-3 font-bold text-sm">Upcoming</p>
				<div className="space-y-0">
					<UpcomingItem
						emoji="🏠"
						text="Rent due"
						sub={fmtDate(nextRentDueDate())}
					/>
					<UpcomingItem
						emoji="⚡"
						text="Submit electricity reading"
						sub={`By end of ${new Date().toLocaleDateString("en-IN", { month: "long" })}`}
					/>
					{activeAgreements
						.filter((agreement) => agreement.endDate)
						.map((agreement) => (
							<UpcomingItem
								key={agreement.id}
								emoji="📄"
								text={`Lease renewal · ${agreement.property.name}`}
								sub={`Expires ${fmtDate(agreement.endDate)}`}
							/>
						))}
				</div>
			</div>
		</div>
	);
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function StatTile({
	label,
	value,
	sub,
}: {
	label: string;
	value: string;
	sub?: string;
}) {
	return (
		<div className="rounded-xl border bg-background p-4">
			<p className="font-medium text-muted-foreground text-xs">{label}</p>
			<p className="mt-1.5 font-extrabold text-xl leading-none">{value}</p>
			{sub && (
				<p className="mt-1 truncate text-muted-foreground text-xs">{sub}</p>
			)}
		</div>
	);
}

function BillPreviewItem({
	emoji,
	label,
	sub,
	amount,
}: {
	emoji: string;
	label: string;
	sub?: string;
	amount: number;
}) {
	return (
		<div className="flex items-center gap-3 px-4 py-2.5">
			<span className="text-xl">{emoji}</span>
			<div className="flex-1">
				<p className="font-medium text-sm">{label}</p>
				{sub && <p className="text-muted-foreground text-xs">{sub}</p>}
			</div>
			<span className="font-bold text-sm">{rupeesCompact(amount)}</span>
		</div>
	);
}

function ActionButton({
	icon,
	label,
	primary,
	whatsapp,
	onClick,
}: {
	icon: React.ReactNode;
	label: string;
	primary?: boolean;
	whatsapp?: boolean;
	onClick?: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border font-medium text-sm transition-colors",
				primary &&
					"border-primary bg-primary text-primary-foreground hover:bg-primary/90",
				whatsapp &&
					"border-[#25D366] bg-[#25D366] text-white hover:bg-[#1ebe5d]",
				!primary && !whatsapp && "bg-background text-foreground hover:bg-muted",
			)}
		>
			{icon}
			{label}
		</button>
	);
}

function UpcomingItem({
	emoji,
	text,
	sub,
}: {
	emoji: string;
	text: string;
	sub: string;
}) {
	return (
		<div className="flex items-center gap-3 border-b py-2.5 last:border-0">
			<span className="text-xl">{emoji}</span>
			<div className="flex-1">
				<p className="font-semibold text-sm">{text}</p>
				<p className="text-muted-foreground text-xs">{sub}</p>
			</div>
		</div>
	);
}

function OverviewSkeleton() {
	return (
		<div className="space-y-3.5">
			<div className="grid grid-cols-2 gap-2.5">
				<div className="col-span-2 h-24 animate-pulse rounded-xl bg-muted" />
				<div className="h-20 animate-pulse rounded-xl bg-muted" />
				<div className="h-20 animate-pulse rounded-xl bg-muted" />
			</div>
			<div className="h-48 animate-pulse rounded-xl bg-muted" />
			<div className="h-36 animate-pulse rounded-xl bg-muted" />
		</div>
	);
}
