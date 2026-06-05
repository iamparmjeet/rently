const stats = [
	{
		icon: (
			<svg
				viewBox="0 0 24 24"
				className="size-4.5 fill-none stroke-primary"
				strokeWidth={2}
			>
				<title>Properties managed</title>
				<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
				<polyline points="9 22 9 12 15 12 15 22" />
			</svg>
		),
		value: "150+",
		label: "Properties managed",
	},
	{
		icon: (
			<svg
				viewBox="0 0 24 24"
				className="size-4.5 fill-none stroke-primary"
				strokeWidth={2}
			>
				<title>Active tenants</title>
				<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
				<circle cx="9" cy="7" r="4" />
				<path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
			</svg>
		),
		value: "2,400+",
		label: "Active tenants",
	},
	{
		icon: (
			<svg
				viewBox="0 0 24 24"
				className="size-4.5 fill-none stroke-primary"
				strokeWidth={2}
			>
				<title>Revenue tracked</title>
				<line x1="12" y1="1" x2="12" y2="23" />
				<path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
			</svg>
		),
		value: "₹12Cr+",
		label: "Revenue tracked",
	},
	{
		icon: (
			<svg
				viewBox="0 0 24 24"
				className="size-4.5 fill-none stroke-primary"
				strokeWidth={2}
			>
				<title>Platform Uptime</title>
				<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
			</svg>
		),
		value: "99.9%",
		label: "Platform uptime",
	},
];

export function TrustBar() {
	return (
		<div className="border-border border-t border-b bg-muted py-6">
			<div className="mx-auto max-w-300 px-7">
				<div className="flex flex-wrap items-center justify-center gap-7 sm:gap-13">
					{stats.map((stat) => (
						<div key={stat.value} className="flex items-center gap-2.5">
							<div className="flex size-9.5 items-center justify-center rounded-md bg-primary/10">
								{stat.icon}
							</div>
							<div>
								<div className="font-extrabold text-[19px] leading-tight">
									{stat.value}
								</div>
								<div className="mt-px text-[12px] text-muted-foreground">
									{stat.label}
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
