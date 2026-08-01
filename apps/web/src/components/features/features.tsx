const features = [
	{
		icon: (
			<svg
				viewBox="0 0 24 24"
				className="size-5.5 fill-none stroke-primary"
				strokeWidth={2}
			>
				<title>Property management</title>
				<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
				<polyline points="9 22 9 12 15 12 15 22" />
			</svg>
		),
		title: "Property Management",
		description:
			"Manage all your properties, units, and tenants in one unified dashboard.",
	},
	{
		icon: (
			<svg
				viewBox="0 0 24 24"
				className="size-5.5 fill-none stroke-primary"
				strokeWidth={2}
			>
				<title>automated rent collection</title>
				<rect x="1" y="4" width="22" height="16" rx="2" />
				<line x1="1" y1="10" x2="23" y2="10" />
			</svg>
		),
		title: "Automated Rent Collection",
		description:
			"Track payments effortlessly with automated reminders and full payment history.",
	},
	{
		icon: (
			<svg
				viewBox="0 0 24 24"
				className="size-5.5 fill-none stroke-primary"
				strokeWidth={2}
			>
				<title>Tenant Management</title>
				<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
				<circle cx="9" cy="7" r="4" />
				<path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
			</svg>
		),
		title: "Tenant Management",
		description:
			"Handle tenant onboarding, invites, and profiles with ease and security.",
	},
	{
		icon: (
			<svg
				viewBox="0 0 24 24"
				className="size-5.5 fill-none stroke-primary"
				strokeWidth={2}
			>
				<title>Utility tracking</title>
				<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
			</svg>
		),
		title: "Utility Tracking",
		description:
			"Monitor electricity, water, and maintenance with automatic calculations.",
	},
];

export function Features() {
	return (
		<section className="py-23" id="features">
			<div className="mx-auto max-w-300 px-7">
				<div className="mx-auto max-w-155 text-center">
					<span className="mb-3.5 inline-block rounded-full bg-primary/10 px-2.75 py-0.75 font-semibold text-[12px] text-primary tracking-[0.1px]">
						Features
					</span>
					<h2 className="text-balance font-extrabold text-[clamp(27px,3vw,40px)] leading-[1.1] tracking-[-1.1px]">
						Everything You Need to Manage Rentals
					</h2>
					<p className="mx-auto mt-2.75 max-w-140 text-pretty text-[16px] text-muted-foreground leading-[1.65]">
						From property listings to payment tracking, KeyHQ covers the entire
						rental lifecycle.
					</p>
				</div>

				<div className="mt-13.5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
					{features.map((feature) => (
						<div
							key={feature.title}
							className="rounded-md border border-border bg-white p-7 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_36px_rgba(0,0,0,0.08)]"
						>
							<div className="mb-3.75 flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
								{feature.icon}
							</div>
							<h3 className="mb-2 font-bold text-[15px]">{feature.title}</h3>
							<p className="text-pretty text-[13.5px] text-muted-foreground leading-[1.62]">
								{feature.description}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
