// src/components/forms/login-form-skeleton.tsx

import { CardContent } from "@rently/ui/components/card";

export function LoginFormSkeleton() {
	return (
		<CardContent className="grid gap-4">
			<div className="grid grid-cols-2 gap-4">
				<div className="h-10 animate-pulse rounded-md bg-muted" />
				<div className="h-10 animate-pulse rounded-md bg-muted" />
			</div>
			<div className="h-4 animate-pulse rounded bg-muted" />
			<div className="grid gap-4">
				<div className="h-10 animate-pulse rounded-md bg-muted" />
				<div className="h-10 animate-pulse rounded-md bg-muted" />
				<div className="h-10 animate-pulse rounded-md bg-muted" />
			</div>
		</CardContent>
	);
}
