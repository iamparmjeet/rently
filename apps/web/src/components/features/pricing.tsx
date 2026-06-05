import Link from "next/link";

const plans = [
	{
		name: "Starter",
		price: "₹0",
		period: "Forever free · Up to 2 properties",
		cta: "Get Started",
		ctaStyle: "border",
		featured: false,
		features: [
			{ label: "Up to 2 properties", included: true },
			{ label: "10 tenants max", included: true },
			{ label: "Basic payment tracking", included: true },
			{ label: "Automated reminders", included: false },
			{ label: "Utility management", included: false },
		],
	},
	{
		name: "Pro",
		price: "₹499",
		priceSuffix: "/mo",
		period: "Billed monthly · Unlimited properties",
		cta: "Start 14-Day Trial",
		ctaStyle: "primary",
		featured: true,
		badge: "Most Popular",
		features: [
			{ label: "Unlimited properties", included: true },
			{ label: "Unlimited tenants", included: true },
			{ label: "Automated reminders", included: true },
			{ label: "Utility management", included: true },
			{ label: "Priority support", included: true },
		],
	},
	{
		name: "Enterprise",
		price: "₹1,499",
		priceSuffix: "/mo",
		period: "Billed monthly · Large portfolios",
		cta: "Contact Sales",
		ctaStyle: "border",
		featured: false,
		features: [
			{ label: "Everything in Pro", included: true },
			{ label: "Custom reports & exports", included: true },
			{ label: "API access", included: true },
			{ label: "Dedicated support", included: true },
			{ label: "White-label option", included: true },
		],
	},
];

export function Pricing() {
	return (
		<section className="bg-muted py-23" id="pricing">
			<div className="mx-auto max-w-300 px-7">
				<div className="mx-auto max-w-155 text-center">
					<span className="mb-3.5 inline-block rounded-full bg-primary/10 px-2.75 py-0.75 font-semibold text-[12px] text-primary tracking-[0.1px]">
						Pricing
					</span>
					<h2 className="text-balance font-extrabold text-[clamp(27px,3vw,40px)] leading-[1.1] tracking-[-1.1px]">
						Simple, Transparent Pricing
					</h2>
					<p className="mx-auto mt-2.75 max-w-140 text-pretty text-[16px] text-muted-foreground leading-[1.65]">
						Start free, scale as you grow. No hidden fees, no surprises — ever.
					</p>
				</div>

				<div className="mt-13.5 grid grid-cols-1 items-start gap-5 sm:grid-cols-3">
					{plans.map((plan) => (
						<div
							key={plan.name}
							className={`rounded-md bg-white p-7.5 ${plan.featured ? "border-2 border-primary shadow-[0_0_0_1px_var(--color-primary),0_10px_36px_oklch(0.488_0.243_264.376/0.2)]" : "border border-border"}`}
						>
							{plan.badge && (
								<span className="mb-3.5 inline-block rounded-full bg-primary px-2.5 py-0.75 font-semibold text-[11px] text-primary-foreground">
									{plan.badge}
								</span>
							)}
							<div className="mb-1 font-bold text-[17px]">{plan.name}</div>
							<div className="my-2.5 mb-0.5 font-extrabold text-[40px] leading-none tracking-[-1.8px]">
								{plan.price}
								{plan.priceSuffix && (
									<sub className="align-baseline font-medium text-[14px] text-muted-foreground tracking-normal">
										{plan.priceSuffix}
									</sub>
								)}
							</div>
							<div className="mb-5.5 text-[13px] text-muted-foreground">
								{plan.period}
							</div>

							<Link
								href="/register"
								className={`inline-flex h-11 w-full items-center justify-center rounded-lg font-semibold text-[15px] no-underline transition-all ${
									plan.ctaStyle === "primary"
										? "bg-primary text-primary-foreground hover:bg-primary-hover"
										: "border border-border bg-transparent text-foreground hover:bg-muted"
								}`}
							>
								{plan.cta}
							</Link>

							<ul className="mt-5.5 mb-6.5 flex list-none flex-col gap-2.25">
								{plan.features.map((feature) => (
									<li
										key={feature.label}
										className={`flex items-center gap-2 text-[13.5px] ${feature.included ? "" : "text-muted-foreground"}`}
									>
										<svg
											viewBox="0 0 24 24"
											className={`size-3.25 shrink-0 fill-none ${feature.included ? "stroke-primary" : "stroke-muted-foreground"}`}
											strokeWidth={2.5}
										>
											<title>feature</title>
											<polyline points="20 6 9 17 4 12" />
										</svg>
										{feature.label}
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
