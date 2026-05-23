// apps/web/src/app/(marketing)/invite/[token]/loading.tsx

export default function InviteLoading() {
	return (
		<div className="container mx-auto flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
			<div className="w-full max-w-md space-y-4">
				{/* Brand skeleton */}
				<div className="mb-8 flex flex-col items-center gap-2">
					<div className="h-12 w-12 animate-pulse rounded-xl bg-muted" />
					<div className="h-5 w-24 animate-pulse rounded bg-muted" />
				</div>
				{/* Card skeleton */}
				<div className="space-y-4 rounded-xl border bg-card p-6">
					<div className="mx-auto h-6 w-48 animate-pulse rounded bg-muted" />
					<div className="h-10 animate-pulse rounded bg-muted" />
					<div className="h-10 animate-pulse rounded bg-muted" />
					<div className="h-10 animate-pulse rounded bg-muted" />
					<div className="h-10 animate-pulse rounded bg-muted" />
					<div className="h-11 animate-pulse rounded-lg bg-muted" />
				</div>
			</div>
		</div>
	);
}
