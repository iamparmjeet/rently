import { Badge } from "@rently/ui/components/badge";
import { Button } from "@rently/ui/components/button";
import { TableCell, TableRow } from "@rently/ui/components/table";
import type { UtilityListItem } from "@rently/validators";
import { IconCheck, IconEdit, IconTrash } from "@tabler/icons-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatRupees } from "@/lib/currency";

interface UtilityTableRowProps {
	utility: UtilityListItem;
	onViewDetail: () => void;
	onEdit: () => void;
	onDelete: () => void;
	onMarkPaid: () => void;
	isDeleting: boolean;
	// isTogglingPaid: boolean;
}

export function UtilityTableRow({
	utility: u,
	onEdit,
	onDelete,
	onMarkPaid,
	onViewDetail,
	isDeleting,
}: UtilityTableRowProps) {
	const readingDate = u.previousReadingDate
		? `${new Date(u.previousReadingDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} → ${new Date(u.currentReadingDate ?? u.previousReading).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`
		: new Date(u.currentReadingDate).toLocaleDateString("en-IN", {
				day: "2-digit",
				month: "short",
				year: "numeric",
			});

	return (
		<TableRow
			className={`cursor-pointer ${isDeleting ? "opacity-50" : ""}`}
			onClick={onViewDetail}
		>
			<TableCell>
				<div className="font-medium">{u.unitNumber}</div>
				<div className="text-muted-foreground text-xs">{u.propertyName}</div>
			</TableCell>
			<TableCell className="text-muted-foreground text-sm">
				{u.tenantName ?? "—"}
			</TableCell>
			<TableCell className="text-sm">{readingDate}</TableCell>
			<TableCell>
				<Badge variant="outline" className="text-xs capitalize">
					{u.utilityType}
				</Badge>
			</TableCell>
			<TableCell className="text-right font-mono text-sm">
				{u.utilityType === "electricity" ? Number(u.unitsUsed).toFixed(2) : "—"}
			</TableCell>
			<TableCell className="text-right font-mono text-sm">
				{formatRupees(u.totalAmount)}
			</TableCell>
			<TableCell>
				<Badge variant={u.isPaid ? "default" : "secondary"}>
					{u.isPaid ? "Paid" : "Unpaid"}
				</Badge>
			</TableCell>
			<TableCell className="flex items-center justify-end gap-1">
				{/*<div
					className="flex items-center justify-end gap-1"
					onClick={(e) => e.stopPropagation()}
				>*/}
				{/* Toggle paid status */}
				{!u.isPaid && (
					<Button
						size="icon"
						variant="ghost"
						className="size-8"
						onClick={onMarkPaid}
						title="Mark as paid"
					>
						<IconCheck className="size-4" />
					</Button>
				)}
				<Button size="icon" variant="ghost" className="size-8" onClick={onEdit}>
					<IconEdit className="size-4" />
				</Button>
				<ConfirmDialog
					title="Delete reading?"
					description="This meter reading will be permanently deleted."
					onConfirm={onDelete}
					trigger={<IconTrash className="size-4" />}
				/>
				{/*</div>*/}
			</TableCell>
		</TableRow>
	);
}
