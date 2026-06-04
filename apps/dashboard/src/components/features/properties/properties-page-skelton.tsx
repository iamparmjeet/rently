import { PropertyCardSkeleton } from "./property-card-skelton";

export function PropertiesPageSkeleton() {
	return (
		<div className="col-span-12 flex flex-col gap-6">
			{/* Header skeleton — unchanged */}
			<div className="flex items-center justify-between">
				<div className="space-y-2">
					<div className="h-7 w-32 animate-pulse rounded-md bg-muted" />
					<div className="h-4 w-48 animate-pulse rounded bg-muted" />
				</div>
				<div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
			</div>

			{/* Stats bar skeleton — unchanged */}
			<div className="grid grid-cols-4 gap-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
				))}
			</div>

			{/* Filters skeleton — unchanged */}
			<div className="h-10 w-full animate-pulse rounded-md bg-muted" />

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: 6 }).map((_, i) => (
					<PropertyCardSkeleton key={i} animationDelay={i * 80} />
				))}
			</div>
		</div>
	);
}
