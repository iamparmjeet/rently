import type { LeaseStatus } from "@rently/db/constants/rent-constants";
import { Badge } from "@rently/ui/components/badge";

interface LeaseStatusBadgeProps {
	status: LeaseStatus;
}

const STATUS_STYLES: Record<LeaseStatus, string> = {
	active: "bg-green-100 text-green-800 hover:bg-green-200",
	expired: "bg-amber-100 text-amber-800 hover:bg-amber-200",
	terminated: "bg-red-100 text-red-800 hover:text-red-200",
};

const STATUS_LABELS: Record<LeaseStatus, string> = {
	active: "Active",
	expired: "Expired",
	terminated: "Terminated",
};

export default function LeaseStatusBadge({ status }: LeaseStatusBadgeProps) {
	return (
		<Badge
			variant="outline"
			className={`${STATUS_STYLES[status]} pointer-events-normal font-medium capitalize`}
		>
			{STATUS_LABELS[status]}
		</Badge>
	);
}
