// apps/web/src/components/features/leases/lease-details.tsx

import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import type { Lease } from "@rently/validators/lease";
import LeaseStatusBadge from "./lease-status-badge";

interface LeaseDetailsProps {
	lease: Lease;
}

function DetailRow({
	label,
	value,
}: {
	label: string;
	value: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-0.5">
			<p className="text-muted-foreground text-xs">{label}</p>
			<p className="font-medium text-sm">{value}</p>
		</div>
	);
}

export function LeaseDetails({ lease }: LeaseDetailsProps) {
	const formatDate = (date: Date | string | null | undefined) => {
		if (!date) return "—";
		return new Date(date).toLocaleDateString("en-IN", {
			day: "2-digit",
			month: "short",
			year: "numeric",
		});
	};

	const formatINR = (amount: number | null | undefined) => {
		if (!amount) return "—";
		return `₹${amount.toLocaleString("en-IN")}`;
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="text-base">Agreement</CardTitle>
					<div className="flex items-center gap-3">
						<LeaseStatusBadge status={lease.status} />
						<span className="font-bold text-2xl">
							{formatINR(lease.rent)}
							<span className="font-normal text-muted-foreground text-sm">
								/mo
							</span>
						</span>
					</div>
				</div>
			</CardHeader>

			<CardContent>
				<div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
					<DetailRow label="Start Date" value={formatDate(lease.startDate)} />
					<DetailRow
						label="End Date"
						value={lease.endDate ? formatDate(lease.endDate) : "Ongoing"}
					/>
					<DetailRow
						label="Security Deposit"
						value={formatINR(lease.deposit)}
					/>
					<DetailRow label="Created" value={formatDate(lease.createdAt)} />
				</div>
			</CardContent>
		</Card>
	);
}
