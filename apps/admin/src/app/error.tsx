"use client";

import { Button } from "@rently/ui/components/button";
import { IconAlertCircle, IconRefresh } from "@tabler/icons-react";
import { Container } from "@/components/shared/container";

export default function AdminError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<Container className="flex flex-col items-center justify-center py-20 text-center">
			<div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-destructive/10">
				<IconAlertCircle className="size-8 text-destructive/70" />
			</div>
			<h2 className="font-semibold text-lg">Something went wrong</h2>
			<p className="mt-1 max-w-sm text-muted-foreground text-sm">
				{error.message || "The console could not load this view."}
			</p>
			<Button variant="outline" className="mt-6" onClick={reset}>
				<IconRefresh className="mr-2 size-4" />
				Try again
			</Button>
		</Container>
	);
}
