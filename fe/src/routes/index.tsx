import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRight,
	Building2,
	CheckCircle2,
	FileText,
	Users,
	Zap,
} from "lucide-react";
import { Button } from "#/components/ui/button";

export const Route = createFileRoute("/")({
	component: HomePage,
});

// ─── Data ────────────────────────────────────────────────────────────────────

const FEATURES = [
	{
		icon: Building2,
		title: "Property & unit management",
		desc: "Add properties, define units, track occupancy status — all in one place.",
	},
	{
		icon: Users,
		title: "Tenant invitations",
		desc: "Invite tenants by email. They onboard themselves; you stay in control.",
	},
	{
		icon: FileText,
		title: "Lease & payment tracking",
		desc: "Create leases, record rent payments, and see exactly what's overdue.",
	},
	{
		icon: Zap,
		title: "Utility billing",
		desc: "Log electricity and water meter readings — amounts calculated automatically.",
	},
];

const PLANS = [
	{
		name: "Basic",
		price: "₹499",
		interval: "/ month",
		limit: "Up to 500 tenants",
		highlight: false,
		features: [
			"Unlimited properties & units",
			"Tenant invitations",
			"Lease management",
			"Utility billing",
			"Payment history",
		],
	},
	{
		name: "Advanced",
		price: "₹1,199",
		interval: "/ month",
		limit: "Unlimited tenants",
		highlight: true,
		features: [
			"Everything in Basic",
			"No tenant cap",
			"Priority support",
			"Advanced reports",
			"Multi-owner access",
		],
	},
];

// ─── Page ─────────────────────────────────────────────────────────────────────

function HomePage() {
	return (
		<div className="flex flex-col">
			<Hero />
			<Features />
			<Pricing />
			<CTA />
		</div>
	);
}

// ─── Sections ────────────────────────────────────────────────────────────────

function Hero() {
	return (
		<section className="relative flex flex-col items-center text-center gap-8 py-24 px-4 overflow-hidden">
			{/* Subtle grid */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 -z-10
          [background-image:linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)]
          [background-size:40px_40px] opacity-40"
			/>
			{/* Radial fade */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,hsl(var(--background))_60%,transparent_100%)]"
			/>

			<span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
				<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
				Now in early access · India
			</span>

			<h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl leading-[1.1]">
				Rent management,{" "}
				<span className="italic font-normal text-muted-foreground">
					finally simple
				</span>
			</h1>

			<p className="max-w-xl text-base text-muted-foreground leading-relaxed">
				RentWise helps property owners across India manage tenants, leases,
				utility bills, and payments — without spreadsheets or WhatsApp chaos.
			</p>

			<div className="flex flex-wrap items-center justify-center gap-3">
				<Button size="lg" asChild>
					<Link to="/register">
						Get started free
						<ArrowRight className="ml-2 h-4 w-4" />
					</Link>
				</Button>
				<Button size="lg" variant="outline" asChild>
					<Link to="/login">Sign in</Link>
				</Button>
			</div>

			<p className="text-xs text-muted-foreground">
				14-day free trial · No credit card required
			</p>
		</section>
	);
}

function Features() {
	return (
		<section className="py-20 px-4 border-t border-border">
			<div className="max-w-5xl mx-auto">
				<p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">
					What you get
				</p>
				<h2 className="text-2xl font-semibold tracking-tight mb-12 max-w-sm">
					Everything a landlord actually needs
				</h2>

				<div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
					{FEATURES.map(({ icon: Icon, title, desc }) => (
						<div key={title} className="flex flex-col gap-3">
							<div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted">
								<Icon className="h-4 w-4 text-foreground" />
							</div>
							<h3 className="font-medium text-sm leading-snug">{title}</h3>
							<p className="text-sm text-muted-foreground leading-relaxed">
								{desc}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

function Pricing() {
	return (
		<section className="py-20 px-4 border-t border-border bg-muted/30">
			<div className="max-w-3xl mx-auto">
				<p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">
					Pricing
				</p>
				<h2 className="text-2xl font-semibold tracking-tight mb-2">
					Simple, honest pricing
				</h2>
				<p className="text-sm text-muted-foreground mb-12">
					Save up to 20% with annual billing.
				</p>

				<div className="grid gap-4 sm:grid-cols-2">
					{PLANS.map((plan) => (
						<div
							key={plan.name}
							className={`relative rounded-xl border p-6 flex flex-col gap-5 bg-card ${
								plan.highlight ? "border-foreground shadow-sm" : "border-border"
							}`}
						>
							{plan.highlight && (
								<span className="absolute -top-3 left-6 rounded-full bg-foreground px-3 py-0.5 text-xs font-medium text-background">
									Popular
								</span>
							)}

							<div>
								<p className="text-sm font-medium">{plan.name}</p>
								<div className="mt-1 flex items-baseline gap-1">
									<span className="text-3xl font-semibold tracking-tight">
										{plan.price}
									</span>
									<span className="text-sm text-muted-foreground">
										{plan.interval}
									</span>
								</div>
								<p className="mt-1 text-xs text-muted-foreground">
									{plan.limit}
								</p>
							</div>

							<ul className="flex flex-col gap-2">
								{plan.features.map((f) => (
									<li key={f} className="flex items-center gap-2 text-sm">
										<CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
										{f}
									</li>
								))}
							</ul>

							<Button
								className="mt-auto w-full"
								variant={plan.highlight ? "default" : "outline"}
								asChild
							>
								<Link to="/register">Start free trial</Link>
							</Button>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

function CTA() {
	return (
		<section className="py-20 px-4 border-t border-border">
			<div className="max-w-xl mx-auto text-center flex flex-col gap-6">
				<h2 className="text-2xl font-semibold tracking-tight">
					Ready to stop managing rent in WhatsApp?
				</h2>
				<p className="text-sm text-muted-foreground">
					Join property owners across India who have switched to RentWise.
				</p>
				<div className="flex justify-center">
					<Button size="lg" asChild>
						<Link to="/register">
							Create your free account
							<ArrowRight className="ml-2 h-4 w-4" />
						</Link>
					</Button>
				</div>
			</div>
		</section>
	);
}
