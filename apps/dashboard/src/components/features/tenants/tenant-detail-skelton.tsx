export function TenantDetailSkeleton() {
	return (
		<div className="col-span-12 space-y-6">
			{/* Breadcrumb */}
			<div className="h-4 w-40 animate-pulse rounded bg-muted" />
			{/* Hero header */}
			<div className="h-20 animate-pulse rounded-xl bg-muted" />
			{/* Stats row */}
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
				))}
			</div>
			{/* Tab nav */}
			<div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
			{/* Content */}
			<div className="h-80 animate-pulse rounded-xl bg-muted" />
		</div>
	);
}
