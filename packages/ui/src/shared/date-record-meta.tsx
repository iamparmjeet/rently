import { cn } from "@rently/ui/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

interface RecordMetaProps {
	createdAt: Date;
	updatedAt: Date;
	className?: string;
}

export function DateRecordMeta({
	createdAt,
	updatedAt,
	className,
}: RecordMetaProps) {
	return (
		<div
			className={cn(
				"flex items-center justify-between border-t pt-4 text-muted-foreground text-xs",
				className,
			)}
		>
			<span>Created {format(new Date(createdAt), "dd MMM yyyy")}</span>
			<span>
				Updated{" "}
				{formatDistanceToNow(new Date(updatedAt), {
					addSuffix: true,
				})}
			</span>
		</div>
	);
}
