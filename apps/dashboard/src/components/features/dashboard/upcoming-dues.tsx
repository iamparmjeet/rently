import { PAYMENT_TYPES } from "@rently/db/constants/rent-constants";
import { Skeleton } from "@rently/ui/components/skeleton";
import { formatRupees } from "@rently/ui/lib/currency";
import type { PaymentListItem } from "@rently/validators";
import { IconArrowRight } from "@tabler/icons-react";
import Link from "next/link";
import { useMemo } from "react";
import { useLeases } from "@/hooks/leases";
import { usePayments } from "@/hooks/payments";

type DueUrgency = "overdue" | "today" | "soon" | "upcoming";

interface DueEntry {
	leaseId: string;
	tenantName: string;
	unitNumber: string;
	propertyName: string;
	amount: number; // paise — pass through formatRupees()
	dueDate: Date;
	daysUntil: number; // negative = overdue
	urgency: DueUrgency;
}

//  Helpers
function getNextDueDate(
	startDate: Date | string,
	rentDueDate: number | null,
): Date {
	const dueDay = rentDueDate ?? new Date(startDate).getDate();
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const thisMonthDue = new Date(today.getFullYear(), today.getMonth(), dueDay);

	return thisMonthDue >= today
		? thisMonthDue
		: new Date(today.getFullYear(), today.getMonth() + 1, dueDay);
}

// Calendar days b/w today and target- negative means past
function getDaysUntil(date: Date): number {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	return Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function classifyUrgency(days: number): DueUrgency {
	if (days < 0) return "overdue";
	if (days === 0) return "today";
	if (days <= 7) return "soon";
	return "upcoming";
}

function isRentPaidThisMonth(
	leaseId: string,
	payments: PaymentListItem[],
): boolean {
	const now = new Date();
	const thisMonth = now.getMonth();
	const thisYear = now.getFullYear();

	return payments.some((p) => {
		if (p.leaseId !== leaseId) return false;

		if (p.type !== PAYMENT_TYPES.RENT) return false;
		if (p.amount <= 0) return false;

		const pd = new Date(p.paymentDate);
		return pd.getMonth() === thisMonth && pd.getFullYear() === thisYear;
	});
}

const URGENCY_CONFIG: Record<
	DueUrgency,
	{
		dotCls: string;
		textCls: string;
		label: (days: number) => string;
	}
> = {
	overdue: {
		dotCls: "bg-destructive",
		textCls: "text-destructive",
		label: (days) => `${Math.abs(days)}d overdue`,
	},
	today: {
		dotCls: "bg-amber-500",
		textCls: "text-amber-600 dark:text-amber-400",
		label: () => "Due today",
	},
	soon: {
		dotCls: "bg-amber-400",
		textCls: "text-amber-600 dark:text-amber-400",
		label: (days) => `Due in ${days}d`,
	},
	upcoming: {
		dotCls: "bg-emerald-500",
		textCls: "text-muted-foreground",
		label: (days) => `Due in ${days}d`,
	},
};

// Main component

export function UpcomingDues({ className = "" }) {
	const { data: leasesData, isLoading: leasesLoading } = useLeases("active");
	const { data: paymentsData, isLoading: paymentsLoading } = usePayments();

	const activeLeases = leasesData?.leases ?? [];
	const allPayments = paymentsData?.payments ?? [];
	const isLoading = leasesLoading || paymentsLoading;

	const dueEntries = useMemo((): DueEntry[] => {
		if (isLoading) return [];
		return (
			activeLeases
				// Filter out leases where rent is already paid this month
				.filter((l) => !isRentPaidThisMonth(l.leaseId, allPayments))
				.map((l): DueEntry => {
					const dueDate = getNextDueDate(l.startDate, l.rentDueDate);
					const daysUntil = getDaysUntil(dueDate);
					return {
						leaseId: l.leaseId,

						tenantName: l.tenantName ?? "Unknown Tenant",
						unitNumber: l.unitNumber,
						propertyName: l.propertyName,
						amount: l.rent, // paise
						dueDate,
						daysUntil,
						urgency: classifyUrgency(daysUntil),
					};
				})

				.sort((a, b) => a.daysUntil - b.daysUntil)

				.slice(0, 6)
		);
	}, [activeLeases, allPayments, isLoading]);

	const overdueCount = dueEntries.filter((e) => e.urgency === "overdue").length;

	return (
		<div
			className={`rounded-2xl border border-border/40 bg-card p-6 shadow-sm ${className}`}
		>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h3 className="font-semibold text-sm">Upcoming Dues</h3>
					{/* Overdue badge — only shown when there's something to act on */}
					{overdueCount > 0 && !isLoading && (
						<p className="mt-0.5 text-destructive text-xs">
							{overdueCount} overdue
						</p>
					)}
				</div>
				{!isLoading && dueEntries.length > 0 && (
					<Link
						href="/payments"
						className="flex items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground"
					>
						View all
						<IconArrowRight className="size-3" />
					</Link>
				)}
			</div>

			{isLoading ? (
				<Loading />
			) : dueEntries.length === 0 ? (
				<EmptyState />
			) : (
				<div className="mt-2 flex flex-col divide-y divide-border/40">
					{dueEntries.map((entry) => (
						<DueRow key={entry.leaseId} entry={entry} />
					))}
				</div>
			)}
		</div>
	);
}

//  Sub components
function DueRow({ entry }: { entry: DueEntry }) {
	const config = URGENCY_CONFIG[entry.urgency];

	const initials = entry.tenantName
		.split(" ")
		.map((w) => w.slice(0, 1))
		.join("")
		.slice(0, 2)
		.toUpperCase();

	return (
		<div className="flex items-center gap-3 py-3">
			{/* Avatar — tenant initials. No image needed; */}
			<div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
				<span className="font-semibold text-[11px] text-primary">
					{initials || "?"}
				</span>
			</div>

			{/* Name + unit context */}
			<div className="min-w-0 flex-1">
				<p className="truncate font-medium text-sm leading-none">
					{entry.tenantName}
				</p>
				<p className="mt-1 truncate text-muted-foreground text-xs">
					{entry.unitNumber} · {entry.propertyName}
				</p>
			</div>

			{/* Amount + urgency label */}
			<div className="flex shrink-0 flex-col items-end gap-1">
				<span className="font-semibold text-sm tabular-nums">
					{formatRupees(entry.amount)}
				</span>
				<span className={`flex items-center gap-1 text-xs ${config.textCls}`}>
					<span
						className={`inline-block size-1.5 rounded-full ${config.dotCls}`}
					/>
					{config.label(entry.daysUntil)}
				</span>
			</div>
		</div>
	);
}

function Loading() {
	return (
		<div className="mt-4 flex flex-col divide-y divide-border/40">
			{Array.from({ length: 4 }).map((_, i) => (
				<div key={i} className="flex items-center gap-4 py-3.5">
					<Skeleton
						className="size-9 rounded-full"
						style={{ animationDelay: `${i * 120}ms` }}
					/>
					<div className="flex-1 space-y-2">
						<Skeleton
							className="h-3 w-36"
							style={{ animationDelay: `${i * 120}ms` }}
						/>
						<Skeleton
							className="h-3 w-24"
							style={{ animationDelay: `${i * 120 + 60}ms` }}
						/>
					</div>
					<Skeleton
						className="h-3 w-16"
						style={{ animationDelay: `${i * 120}ms` }}
					/>
				</div>
			))}
		</div>
	);
}

function EmptyState() {
	return (
		<div className="mt-6 flex flex-col items-center justify-center py-8 text-center">
			<p className="font-medium text-muted-foreground text-sm">
				All caught up!
			</p>
			<p className="mt-1 text-muted-foreground text-xs">
				No rent due from active tenants this month.
			</p>
		</div>
	);
}
