import { Badge } from "@rently/ui/components/badge";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@rently/ui/components/sheet";
import type { UtilityListItem } from "@rently/validators";
import { formatRupees } from "@/lib/currency";
import { UtilityDetailCard } from "./utility-detail-card";

export function UtilityDetailSheet({
	items,
	open,
	onOpenChange,
	onMarkPaid,
}: {
	items: UtilityListItem[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onMarkPaid: (u: UtilityListItem) => void;
}) {
	if (items.length === 0) return null;

	const first = items[0];
	const grandTotal = items.reduce((sum, u) => sum + u.totalAmount, 0);
	const allPaid = items.every((u) => u.isPaid);

	const periodLabel =
		first?.previousReadingDate && first?.currentReadingDate
			? `${new Date(first.previousReadingDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })} → ${new Date(first.currentReadingDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}`
			: null;

	// WHY compute days: owner wants to know if they're billing 30 or 60 days.
	const days =
		first?.previousReadingDate && first?.currentReadingDate
			? Math.round(
					(new Date(first.currentReadingDate).getTime() -
						new Date(first.previousReadingDate).getTime()) /
						(1000 * 60 * 60 * 24),
				)
			: null;

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="parm w-full max-w-md overflow-y-auto sm:max-w-lg">
				<SheetHeader>
					<SheetTitle>
						{first?.unitNumber} — {first?.propertyName}
					</SheetTitle>
					{first?.tenantName && (
						<p className="text-muted-foreground text-sm">{first.tenantName}</p>
					)}
				</SheetHeader>

				<div className="mt-6 space-y-5">
					{/* Period */}
					{periodLabel && (
						<div className="rounded-md bg-muted px-4 py-3 text-sm">
							<span className="text-muted-foreground">Billing period: </span>
							<span className="font-medium">{periodLabel}</span> <br />
							{days !== null && (
								<span className="text-muted-foreground">
									Total Days: {days} days
								</span>
							)}
						</div>
					)}

					{/* Each utility type in the batch */}
					{items.map((u) => (
						<UtilityDetailCard
							key={u.id}
							utility={u}
							onMarkPaid={() => onMarkPaid(u)}
						/>
					))}

					{/* Grand total */}
					{items.length > 1 && (
						<div className="flex items-center justify-between rounded-md border px-4 py-3 font-semibold">
							<span>Total Bill</span>
							<span>{formatRupees(grandTotal)}</span>
						</div>
					)}

					{/* Overall status */}
					<div className="flex items-center gap-2">
						<Badge variant={allPaid ? "default" : "secondary"}>
							{allPaid ? "Fully Paid" : "Has Unpaid Items"}
						</Badge>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}
