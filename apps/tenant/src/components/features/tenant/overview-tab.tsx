"use client";

import { cn } from "@rently/ui/lib/utils";
import {
	IconBolt,
	IconFileText,
	IconMessageCircle,
	IconTool,
} from "@tabler/icons-react";
import {
	useTenantLease,
	useTenantPayments,
	useTenantUtilities,
} from "@/hooks/tenant-portal";
import { fmtDate, nextRentDueDate, rupeesCompact } from "@/utils/format";
import type { TenantPortalTab } from "./tenant-dashboard";

interface OverviewTabProps {
	onTabChange: (tab: TenantPortalTab) => void;
}

// Given sorted-desc utilities, return the most recent entry per type
function latestByType(
	utils: {
		utilityType: string;
		totalAmount: number;
		previousReading: number | null;
		currentReading: number | null;
		unitsUsed: number | null;
		ratePerUnit: number | null;
		fixedCharge: number | null;
	}[],
) {
	return utils.reduce<Record<string, (typeof utils)[0]>>((acc, u) => {
		if (!acc[u.utilityType]) acc[u.utilityType] = u;
		return acc;
	}, {});
}

export function OverviewTab({ onTabChange }: OverviewTabProps) {
	const { data: leaseData, isLoading: leaseLoading } = useTenantLease();
	const { data: paymentsData } = useTenantPayments();
	const { data: utilitiesData } = useTenantUtilities();

	const lease = leaseData?.lease;
	const payments = paymentsData?.payments ?? [];
	const utilities = utilitiesData?.utilities ?? [];

	const latest = latestByType(utilities);
	const electricityAmt = latest.electricity?.totalAmount ?? 0;
	const waterAmt = latest.water?.totalAmount ?? 0;
	const maintenanceAmt = latest.maintenance?.totalAmount ?? 0;
	const totalDue =
		(lease?.rent ?? 0) + electricityAmt + waterAmt + maintenanceAmt;

	const elecUnitsUsed = latest.electricity?.unitsUsed ?? null;

	const ytdPaid = payments
		.filter((p) => p.amount > 0 && p.type !== "reversal")
		.reduce((s, p) => s + p.amount, 0);

	if (leaseLoading) return <OverviewSkeleton />;

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

	const currentMonth = new Date().toLocaleDateString("en-IN", {
		month: "long",
		year: "numeric",
	});

	return (
		<div className="space-y-3.5">
			{/* ── Stats grid ─────────────────────────────────────── */}
			<div className="grid grid-cols-2 gap-2.5">
				{/* Primary tile — full-width on small, half on larger */}
				<div className="col-span-2 rounded-xl bg-primary p-4 text-primary-foreground">
					<p className="font-medium text-primary-foreground/75 text-xs">
						This Month Due
					</p>
					<p className="mt-1 font-extrabold text-3xl leading-none">
						{rupeesCompact(totalDue)}
					</p>
					<p className="mt-1 text-primary-foreground/60 text-xs">
						Due by {fmtDate(nextRentDueDate())}
					</p>
				</div>

				<StatTile
					label="Total Paid (YTD)"
					value={rupeesCompact(ytdPaid)}
					sub="All transactions"
				/>
				<StatTile
					label="Monthly Rent"
					value={rupeesCompact(lease.rent)}
					sub={lease.property.name}
				/>
				<StatTile
					label="Unit"
					value={lease.unit.unitNumber}
					sub={lease.property.name}
				/>
				<StatTile
					label="Lease Status"
					value="Active"
					sub={lease.endDate ? `Ends ${fmtDate(lease.endDate)}` : "Ongoing"}
				/>
			</div>

			{/* ── Bill preview ───────────────────────────────────── */}
			<div className="overflow-hidden rounded-xl border bg-background">
				<div className="px-4 py-3">
					<p className="font-bold text-sm">Bill Preview — {currentMonth}</p>
					<p className="text-muted-foreground text-xs">
						Unit {lease.unit.unitNumber} · {lease.property.name}
					</p>
				</div>
				<div className="divide-y divide-border">
					<BillPreviewItem
						emoji="🏠"
						label="Monthly Rent"
						amount={lease.rent}
					/>
					{electricityAmt > 0 && (
						<BillPreviewItem
							emoji="⚡"
							label={`Electricity (${elecUnitsUsed ?? "—"} units)`}
							amount={electricityAmt}
						/>
					)}
					{waterAmt > 0 && (
						<BillPreviewItem
							emoji="💧"
							label="Water Charges"
							amount={waterAmt}
						/>
					)}
					{maintenanceAmt > 0 && (
						<BillPreviewItem
							emoji="🔧"
							label="Maintenance"
							amount={maintenanceAmt}
						/>
					)}
				</div>
				<div className="flex items-center justify-between bg-primary px-4 py-3">
					<span className="font-bold text-primary-foreground text-sm">
						Total Due
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
						label="WhatsApp Owner"
						whatsapp
						onClick={() => {
							const msg = encodeURIComponent(
								`Hi, this is ${lease.owner.name}'s tenant from Unit ${lease.unit.unitNumber}, ${lease.property.name}.`,
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
					{lease.endDate && (
						<UpcomingItem
							emoji="📄"
							text="Lease renewal"
							sub={`Expires ${fmtDate(lease.endDate)}`}
						/>
					)}
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
	amount,
}: {
	emoji: string;
	label: string;
	amount: number;
}) {
	return (
		<div className="flex items-center gap-3 px-4 py-2.5">
			<span className="text-xl">{emoji}</span>
			<span className="flex-1 font-medium text-sm">{label}</span>
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
