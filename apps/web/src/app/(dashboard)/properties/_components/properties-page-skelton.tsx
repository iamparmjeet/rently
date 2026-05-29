// Shown by Suspense fallback only on direct URL navigation.

export function PropertiesPageSkeleton() {
	return (
		<div className="col-span-12 flex flex-col gap-6">
			{/* Header skeleton */}
			<div className="flex items-center justify-between">
				<div className="space-y-2">
					<div className="h-7 w-32 animate-pulse rounded-md bg-muted" />
					<div className="h-4 w-48 animate-pulse rounded bg-muted" />
				</div>
				<div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
			</div>

			{/* Stats bar skeleton */}
			<div className="grid grid-cols-4 gap-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
				))}
			</div>

			{/* Filters skeleton */}
			<div className="h-10 w-full animate-pulse rounded-md bg-muted" />

			{/* Grid skeleton — 3 cards */}
			<div className="grid grid-cols-3 gap-4">
				{Array.from({ length: 3 }).map((_, i) => (
					<div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />
				))}
			</div>
		</div>
	);
}
