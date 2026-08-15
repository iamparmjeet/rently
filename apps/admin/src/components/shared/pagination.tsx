"use client";

import { Button } from "@rently/ui/components/button";

export function Pagination({
	page,
	totalPages,
	onPageChange,
}: {
	page: number;
	totalPages: number;
	onPageChange: (page: number) => void;
}) {
	return (
		<div className="flex items-center justify-between border-t px-4 py-3">
			<p className="text-muted-foreground text-xs">
				Page {page} of {Math.max(totalPages, 1)}
			</p>
			<div className="flex gap-2">
				<Button
					variant="outline"
					disabled={page <= 1}
					onClick={() => onPageChange(page - 1)}
				>
					Previous
				</Button>
				<Button
					variant="outline"
					disabled={page >= totalPages}
					onClick={() => onPageChange(page + 1)}
				>
					Next
				</Button>
			</div>
		</div>
	);
}
