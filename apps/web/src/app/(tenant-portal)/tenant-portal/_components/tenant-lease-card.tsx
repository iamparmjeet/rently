// src/app/(tenant-portal)/tenant-portal/_components/tenant-lease-card.tsx

import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import { IconCalendar, IconCoin, IconFileText } from "@tabler/icons-react";

interface TenantLeaseInfo {
	id: string;
	unitNumber: string;
	propertyName: string;
	startDate: Date;
	endDate: Date | null;
	rent: number;
	deposit: number | null;
	status: "active" | "expired" | "terminated";
}

interface TenantLeaseCardProps {
	lease: TenantLeaseInfo | null;
	isLoading: boolean;
}

const statusConfig = {
	active: { label: "Active", className: "bg-emerald-100 text-emerald-700" },
	expired: { label: "Expired", className: "bg-amber-100 text-amber-700" },
	terminated: { label: "Terminated", className: "bg-red-100 text-red-700" },
} satisfies Record<
	TenantLeaseInfo["status"],
	{ label: string; className: string }
>;

export function TenantLeaseCard({ lease, isLoading }: TenantLeaseCardProps) {
	if (isLoading) {
		return (
			<Card>
				<CardContent className="py-8 text-center text-muted-foreground text-sm">
					Loading lease details…
				</CardContent>
			</Card>
		);
	}

	if (!lease) {
		return (
			<Card>
				<CardContent className="py-8 text-center text-muted-foreground text-sm">
					No active lease found. Contact your landlord if you believe this is an
					error.
				</CardContent>
			</Card>
		);
	}

	const { label, className } = statusConfig[lease.status];

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between pb-3">
				<CardTitle className="flex items-center gap-2 text-base">
					<IconFileText className="h-4 w-4 text-muted-foreground" />
					Lease Agreement
				</CardTitle>
				<span
					className={`rounded-full px-2.5 py-0.5 font-medium text-xs ${className}`}
				>
					{label}
				</span>
			</CardHeader>

			<CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<div>
					<p className="text-muted-foreground text-xs">Monthly Rent</p>
					<p className="mt-0.5 flex items-center gap-1 font-semibold text-xl">
						<IconCoin className="h-4 w-4 text-muted-foreground" />₹
						{lease.rent.toLocaleString("en-IN")}
					</p>
				</div>

				<div>
					<p className="text-muted-foreground text-xs">Security Deposit</p>
					<p className="mt-0.5 font-semibold text-xl">
						{lease.deposit ? `₹${lease.deposit.toLocaleString("en-IN")}` : "—"}
					</p>
				</div>

				<div>
					<p className="text-muted-foreground text-xs">Start Date</p>
					<p className="mt-0.5 flex items-center gap-1 font-medium text-sm">
						<IconCalendar className="h-3.5 w-3.5 text-muted-foreground" />
						{new Date(lease.startDate).toLocaleDateString("en-IN")}
					</p>
				</div>

				<div>
					<p className="text-muted-foreground text-xs">End Date</p>
					<p className="mt-0.5 font-medium text-sm">
						{lease.endDate
							? new Date(lease.endDate).toLocaleDateString("en-IN")
							: "Ongoing"}
					</p>
				</div>
			</CardContent>
		</Card>
	);
}
