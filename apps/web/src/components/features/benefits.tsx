const benefits = [
	"Manage properties, units, tenants, and leases in one workspace",
	"Track rent payments and review payment history",
	"Create and manage utility charges alongside rent",
	"Review important rental activity through in-app notifications",
	"Give tenants access through a dedicated web portal",
];

const betaCapabilities = [
	{ label: "Properties and units", value: "Included" },
	{ label: "Lease tracking", value: "Included" },
	{ label: "Utility billing", value: "Included" },
	{ label: "Tenant portal", value: "Included" },
];

export function Benefits() {
	return (
		<section className="py-23">
			<div className="mx-auto max-w-300 px-7">
				<div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-19">
					{/* Left: checklist */}
					<div>
						<span className="mb-3.5 inline-block rounded-full bg-primary/10 px-2.75 py-0.75 font-semibold text-[12px] text-primary tracking-[0.1px]">
							Why KeyHQ
						</span>
						<h2 className="text-balance font-extrabold text-[clamp(27px,3vw,40px)] leading-[1.1] tracking-[-1.1px]">
							Built for Indian Landlords
						</h2>
						<p className="mt-2.75 max-w-140 text-pretty text-[16px] text-muted-foreground leading-[1.65]">
							Purpose-built for the Indian rental market — from independent
							landlords to large property managers.
						</p>
						<ul className="mt-7.5 flex list-none flex-col gap-3.75">
							{benefits.map((benefit) => (
								<li key={benefit} className="flex items-start gap-2.75">
									<div className="mt-px flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-primary/10">
										<svg
											viewBox="0 0 24 24"
											className="size-2.75 fill-none stroke-primary"
											strokeWidth={2.5}
										>
											<title>benefit</title>
											<polyline points="20 6 9 17 4 12" />
										</svg>
									</div>
									<span className="text-[15px] leading-[1.55]">{benefit}</span>
								</li>
							))}
						</ul>
					</div>

					{/* Right: capabilities widget */}
					<div
						className="overflow-hidden rounded-[14px] border border-border bg-white"
						style={{ boxShadow: "0 10px 44px rgba(0,0,0,0.07)" }}
					>
						<div className="bg-primary px-6 py-5 text-primary-foreground">
							<h3 className="font-bold text-[15px]">KeyHQ Essentials</h3>
							<p className="mt-0.5 text-[12.5px] opacity-70">
								Core property-management workflows available in beta
							</p>
						</div>
						<div className="px-6 py-0.5">
							{betaCapabilities.map((stat, i) => (
								<div
									key={stat.label}
									className={`flex items-center justify-between py-3.75 ${i < betaCapabilities.length - 1 ? "border-border border-b" : ""}`}
								>
									<span className="font-bold">{stat.label}</span>
									<span className="text-base text-muted-foreground">
										{stat.value}
									</span>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
