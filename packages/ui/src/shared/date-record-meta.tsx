"use client";

import { cn } from "@rently/ui/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";

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
	const [hasMounted, setHasMounted] = useState(false);

	useEffect(() => {
		setHasMounted(true);
	}, []);

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
				{hasMounted
					? formatDistanceToNow(new Date(updatedAt), { addSuffix: true })
					: "—"}
			</span>
		</div>
	);
}
