// src/app/(dashboard)/page.tsx
export default function DashboardPage() {
	return (
		<>
			{/* Large Feature Card - spans 8 columns, 2 rows */}
			<div className="col-span-8 row-span-2 rounded-[calc(var(--radius)*2.2)] border border-border/50 bg-card p-6 shadow-foreground/5 shadow-xl">
				<h2 className="font-semibold text-card-foreground text-lg">
					Revenue Overview
				</h2>
				{/* Chart content */}
			</div>

			{/* Primary Stat Card - spans 4 columns */}
			<div className="col-span-4 rounded-[calc(var(--radius)*2.2)] bg-linear-to-br from-primary to-primary/80 p-6 text-primary-foreground shadow-primary/25 shadow-xl">
				<p className="text-sm opacity-80">Total Properties</p>
				<p className="mt-2 font-bold text-4xl">24</p>
			</div>

			{/* Secondary Card - spans 4 columns */}
			<div className="col-span-4 rounded-[calc(var(--radius)*2.2)] border border-border/50 bg-card p-6 shadow-foreground/5 shadow-xl">
				<h3 className="font-medium text-muted-foreground text-sm">
					Active Tenants
				</h3>
				<p className="mt-2 font-bold text-3xl text-card-foreground">18</p>
			</div>

			{/* Accent Card - spans 4 columns */}
			<div className="col-span-4 rounded-[calc(var(--radius)*2.2)] border border-border/50 bg-accent p-6 text-accent-foreground shadow-accent/25 shadow-xl">
				<h3 className="text-sm opacity-80">Monthly Revenue</h3>
				<p className="mt-2 font-bold text-3xl">$12,450</p>
			</div>

			{/* Full Width Table Card */}
			<div className="col-span-12 rounded-[calc(var(--radius)*2.2)] border border-border/50 bg-card p-6 shadow-foreground/5 shadow-xl">
				<h3 className="font-medium text-muted-foreground text-sm">
					Recent Transactions
				</h3>
			</div>
		</>
	);
}
