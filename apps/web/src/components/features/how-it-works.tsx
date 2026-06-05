const steps = [
	{
		number: "01",
		title: "Add Your Properties",
		description:
			"Register residential or commercial properties and define units with base rent and details.",
	},
	{
		number: "02",
		title: "Invite Your Tenants",
		description:
			"Send email invites — tenants complete their own profiles securely in minutes.",
	},
	{
		number: "03",
		title: "Track Everything",
		description:
			"Monitor rent, utilities, and maintenance with automatic calculations and real-time status.",
	},
];

export function HowItWorks() {
	return (
		<section className="bg-muted py-23" id="how-it-works">
			<div className="mx-auto max-w-300 px-7">
				<div className="mx-auto max-w-155 text-center">
					<span className="mb-3.5 inline-block rounded-full bg-primary/10 px-2.75 py-0.75 font-semibold text-[12px] text-primary tracking-[0.1px]">
						How It Works
					</span>
					<h2 className="text-balance font-extrabold text-[clamp(27px,3vw,40px)] leading-[1.1] tracking-[-1.1px]">
						Up and Running in Minutes
					</h2>
					<p className="mx-auto mt-2.75 max-w-140 text-pretty text-[16px] text-muted-foreground leading-[1.65]">
						Get started and take full control of your properties — no training
						required.
					</p>
				</div>

				<div className="relative mt-13.5 grid grid-cols-1 gap-9 sm:grid-cols-3 sm:gap-13">
					{/* Dashed connector line (desktop only) */}
					<div
						className="absolute top-6.5 hidden sm:block"
						style={{
							left: "13%",
							right: "13%",
							height: "1px",
							background:
								"repeating-linear-gradient(90deg, var(--color-border) 0, var(--color-border) 8px, transparent 8px, transparent 18px)",
						}}
					/>

					{steps.map((step) => (
						<div key={step.number}>
							<div
								className="relative z-1 mb-4.5 flex h-13 w-13 items-center justify-center rounded-full border border-border bg-white font-extrabold text-[14px] text-primary"
								style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.07)" }}
							>
								{step.number}
							</div>
							<h3 className="mb-2.25 font-bold text-[20px] tracking-[-0.3px]">
								{step.title}
							</h3>
							<p className="text-pretty text-[14px] text-muted-foreground leading-[1.68]">
								{step.description}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
