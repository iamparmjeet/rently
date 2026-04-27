// src/app/(dashboard)/page.tsx
export default function DashboardPage() {
	return (
		<>
			{/* Large Feature Card - spans 8 columns, 2 rows */}
			<div className="col-span-8 row-span-2 rounded-[calc(var(--radius)*2.2)] border border-border/50 bg-card p-6 shadow-xl shadow-foreground/5">
				<h2 className="text-lg font-semibold text-card-foreground">
					Revenue Overview
				</h2>
				{/* Chart content */}
			</div>

			{/* Primary Stat Card - spans 4 columns */}
			<div className="col-span-4 rounded-[calc(var(--radius)*2.2)] bg-linear-to-br from-primary to-primary/80 p-6 text-primary-foreground shadow-xl shadow-primary/25">
				<p className="text-sm opacity-80">Total Properties</p>
				<p className="mt-2 text-4xl font-bold">24</p>
			</div>

			{/* Secondary Card - spans 4 columns */}
			<div className="col-span-4 rounded-[calc(var(--radius)*2.2)] border border-border/50 bg-card p-6 shadow-xl shadow-foreground/5">
				<h3 className="text-sm font-medium text-muted-foreground">
					Active Tenants
				</h3>
				<p className="mt-2 text-3xl font-bold text-card-foreground">18</p>
			</div>

			{/* Accent Card - spans 4 columns */}
			<div className="col-span-4 rounded-[calc(var(--radius)*2.2)] border border-border/50 bg-accent p-6 text-accent-foreground shadow-xl shadow-accent/25">
				<h3 className="text-sm opacity-80">Monthly Revenue</h3>
				<p className="mt-2 text-3xl font-bold">$12,450</p>
			</div>

			{/* Full Width Table Card */}
			<div className="col-span-12 rounded-[calc(var(--radius)*2.2)] border border-border/50 bg-card p-6 shadow-xl shadow-foreground/5">
				<h3 className="text-sm font-medium text-muted-foreground">
					Recent Transactions
				</h3>
			</div>
		</>
	);
}
