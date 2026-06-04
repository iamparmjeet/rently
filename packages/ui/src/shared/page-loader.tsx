interface PageLoaderProps {
	rows?: number;
}

export function PageLoader({ rows = 3 }: PageLoaderProps) {
	return (
		<div className="col-span-12 space-y-4">
			<div className="h-8 w-48 animate-pulse rounded bg-muted">
				{Array.from({ length: rows }).map((_, i) => (
					<div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
				))}
			</div>
		</div>
	);
}
