// src/components/forms/register-form-skeleton.tsx

import { CardContent } from "@rently/ui/components/card";

export function RegisterFormSkeleton() {
	return (
		<CardContent className="grid gap-4">
			{/* Social buttons */}
			<div className="grid grid-cols-2 gap-4">
				<div className="h-10 animate-pulse rounded-md bg-muted" />
				<div className="h-10 animate-pulse rounded-md bg-muted" />
			</div>

			{/* Divider */}
			<div className="h-4 animate-pulse rounded bg-muted" />

			{/* Name, Email, Phone, Password, Confirm Password */}
			<div className="grid gap-4">
				<div className="grid gap-2">
					<div className="h-4 w-20 animate-pulse rounded bg-muted" />
					<div className="h-10 animate-pulse rounded-md bg-muted" />
				</div>
				<div className="grid gap-2">
					<div className="h-4 w-10 animate-pulse rounded bg-muted" />
					<div className="h-10 animate-pulse rounded-md bg-muted" />
				</div>
				<div className="grid gap-2">
					<div className="h-4 w-28 animate-pulse rounded bg-muted" />
					<div className="h-10 animate-pulse rounded-md bg-muted" />
				</div>
				<div className="grid gap-2">
					<div className="h-4 w-16 animate-pulse rounded bg-muted" />
					<div className="h-10 animate-pulse rounded-md bg-muted" />
					<div className="h-3 w-48 animate-pulse rounded bg-muted" />
				</div>
				<div className="grid gap-2">
					<div className="h-4 w-32 animate-pulse rounded bg-muted" />
					<div className="h-10 animate-pulse rounded-md bg-muted" />
				</div>

				{/* Submit button */}
				<div className="h-10 animate-pulse rounded-md bg-muted" />
			</div>

			{/* Terms + sign in link */}
			<div className="mx-auto h-3 w-64 animate-pulse rounded bg-muted" />
			<div className="mx-auto h-4 w-48 animate-pulse rounded bg-muted" />
		</CardContent>
	);
}
