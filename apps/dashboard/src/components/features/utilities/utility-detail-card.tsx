import { Badge } from "@rently/ui/components/badge";
import { Button } from "@rently/ui/components/button";
import { formatRupees } from "@rently/ui/lib/currency";
import type { UtilityListItem } from "@rently/validators";

export function UtilityDetailCard({
	utility: u,
	onMarkPaid,
}: {
	utility: UtilityListItem;
	onMarkPaid: () => void;
}) {
	const isElectricity = u.utilityType === "electricity";

	return (
		<div className="space-y-3 rounded-lg border p-4">
			<div className="flex items-center justify-between">
				<span className="font-medium capitalize">
					{u.utilityType === "electricity"
						? "⚡ Electricity"
						: u.utilityType === "water"
							? "💧 Water"
							: "🔧 Maintenance"}
				</span>
				<Badge variant={u.isPaid ? "default" : "secondary"} className="text-xs">
					{u.isPaid ? "Paid" : "Unpaid"}
				</Badge>
			</div>

			{isElectricity && (
				<div className="grid grid-cols-2 gap-2 text-sm">
					<div>
						<p className="text-muted-foreground">Previous</p>
						<p className="font-mono">{Number(u.previousReading).toFixed(2)}</p>
					</div>
					<div>
						<p className="text-muted-foreground">Current</p>
						<p className="font-mono">{Number(u.currentReading).toFixed(2)}</p>
					</div>
					<div>
						<p className="text-muted-foreground">Units Used</p>
						<p className="font-mono">{Number(u.unitsUsed).toFixed(2)}</p>
					</div>
					<div>
						<p className="text-muted-foreground">Rate / Unit</p>
						<p className="font-mono">{formatRupees(u.ratePerUnit ?? 0)}</p>
					</div>
					<div>
						<p className="text-muted-foreground">Fixed Charge</p>
						<p className="font-mono">{formatRupees(u.fixedCharge ?? 0)}</p>
					</div>
				</div>
			)}

			{!isElectricity && u.description && (
				<p className="text-muted-foreground text-sm">{u.description}</p>
			)}

			<div className="flex items-center justify-between border-t pt-2">
				<span className="font-semibold">{formatRupees(u.totalAmount)}</span>
				{!u.isPaid && (
					<Button size="sm" onClick={onMarkPaid}>
						Mark Paid
					</Button>
				)}
			</div>
		</div>
	);
}
