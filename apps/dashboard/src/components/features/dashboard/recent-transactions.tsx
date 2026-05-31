interface RecentTransactionsProps {
	className?: string;
}

export function RecentTransactions({
	className = "",
}: RecentTransactionsProps) {
	return (
		<div
			className={`rounded-2xl border border-border/40 bg-card p-6 shadow-sm ${className}`}
		>
			<div className="flex items-center justify-between">
				<div>
					<h3 className="font-semibold text-base">Recent Transactions</h3>
					<p className="mt-0.5 text-muted-foreground text-sm">
						Latest rent and payment activity
					</p>
				</div>
				<span className="rounded-lg bg-muted/60 px-3 py-1.5 text-muted-foreground text-xs">
					Coming soon
				</span>
			</div>

			<div className="mt-4 flex flex-col divide-y divide-border/40">
				{Array.from({ length: 4 }).map((_, i) => (
					<div key={i} className="flex items-center gap-4 py-3.5">
						<div
							className="size-9 animate-pulse rounded-full bg-muted"
							style={{ animationDelay: `${i * 120}ms` }}
						/>
						<div className="flex-1 space-y-2">
							<div
								className="h-3 w-36 animate-pulse rounded bg-muted"
								style={{ animationDelay: `${i * 120}ms` }}
							/>
							<div
								className="h-3 w-24 animate-pulse rounded bg-muted/60"
								style={{ animationDelay: `${i * 120 + 60}ms` }}
							/>
						</div>
						<div
							className="h-3 w-20 animate-pulse rounded bg-muted"
							style={{ animationDelay: `${i * 120}ms` }}
						/>
					</div>
				))}
			</div>
		</div>
	);
}
