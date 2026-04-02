// src/app/(marketing)/page.tsx

import {
    IconArrowRight,
	IconChecklist,
	IconCreditCard,
	IconHome,
	IconShieldUp,
	IconUsers,
} from "@tabler/icons-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const features = [
	{
		icon: IconHome,
		title: "Property Management",
		description:
			"Manage all your properties, units, and tenants in one unified dashboard.",
	},
	{
		icon: IconCreditCard,
		title: "Automated Rent Collection",
		description:
			"Track payments effortlessly with automated reminders and payment history.",
	},
	{
		icon: IconUsers,
		title: "Tenant Management",
		description: "Handle tenant onboarding, invites, and profiles with ease.",
	},
	{
		icon: IconShieldUp,
		title: "Utility Tracking",
		description:
			"Monitor electricity, water, and maintenance utilities with automatic calculations.",
	},
];

const steps = [
	{
		number: "01",
		title: "Add Your Properties",
		description:
			"Register your residential or commercial properties and define units with base rent.",
	},
	{
		number: "02",
		title: "Invite Tenants",
		description:
			"Send invites to tenants and let them complete their profiles securely.",
	},
	{
		number: "03",
		title: "Track Payments & Utilities",
		description:
			"Monitor rent payments and utilities with automatic calculations and status tracking.",
	},
];

export default function HomePage() {
	return (
		<div className="flex min-h-screen flex-col">

			<main className="flex-1">
				{/* Hero Section */}
				<section className="relative overflow-hidden py-20 md:py-32">
					<div className="container mx-auto px-4">
						<div className="mx-auto max-w-3xl text-center">
							<h1 className="text-4xl font-bold tracking-tight md:text-6xl">
								Property Management,{" "}
								<span className="text-primary">Simplified</span>
							</h1>
							<p className="mt-6 text-lg text-muted-foreground md:text-xl">
								RentWise helps landlords and property managers track tenants,
								automate rent collection, and manage utilities — all in one
								place.
							</p>
							<div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
								<Button size="lg">
									<Link href="/register">
										Get Started Free
									</Link>
										<IconArrowRight className="ml-2 h-4 w-4" />
								</Button>
								<Button size="lg" variant="outline">
									<Link href="#how-it-works">See How It Works</Link>
								</Button>
							</div>
						</div>
					</div>

					{/* Decorative gradient */}
					<div className="absolute -top-1/2 left-1/2 -z-10 h-125 w-125 -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
				</section>

				{/* Features Section */}
				<section id="features" className="py-20 bg-muted/50">
					<div className="container mx-auto px-4">
						<div className="mx-auto max-w-2xl text-center">
							<h2 className="text-3xl font-bold tracking-tight md:text-4xl">
								Everything You Need
							</h2>
							<p className="mt-4 text-muted-foreground">
								From property listings to payment tracking, RentWise covers the
								entire rental lifecycle.
							</p>
						</div>

						<div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
							{features.map((feature) => (
								<div
									key={feature.title}
									className="flex flex-col items-start gap-4 rounded-lg border bg-background p-6"
								>
									<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
										<feature.icon className="h-6 w-6 text-primary" />
									</div>
									<h3 className="text-lg font-semibold">{feature.title}</h3>
									<p className="text-sm text-muted-foreground">
										{feature.description}
									</p>
								</div>
							))}
						</div>
					</div>
				</section>

				{/* How It Works Section */}
				<section id="how-it-works" className="py-20">
					<div className="container mx-auto px-4">
						<div className="mx-auto max-w-2xl text-center">
							<h2 className="text-3xl font-bold tracking-tight md:text-4xl">
								How It Works
							</h2>
							<p className="mt-4 text-muted-foreground">
								Get started in minutes and take control of your properties.
							</p>
						</div>

						<div className="mt-16 grid gap-8 md:grid-cols-3">
							{steps.map((step) => (
								<div
									key={step.number}
									className="relative flex flex-col items-start"
								>
									<span className="text-6xl font-bold text-muted/20">
										{step.number}
									</span>
									<h3 className="mt-2 text-xl font-semibold">{step.title}</h3>
									<p className="mt-2 text-muted-foreground">
										{step.description}
									</p>
								</div>
							))}
						</div>
					</div>
				</section>

				{/* CTA Section */}
				<section className="py-20">
					<div className="container mx-auto px-4">
						<div className="rounded-2xl bg-primary px-6 py-16 text-center md:px-16">
							<h2 className="text-3xl font-bold tracking-tight text-primary-foreground md:text-4xl">
								Ready to Simplify Your Property Management?
							</h2>
							<p className="mx-auto mt-4 max-w-2xl text-lg text-primary-foreground/80">
								Join thousands of landlords who trust RentWise to manage their
								rental properties efficiently.
							</p>
							<div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
								<Button
									size="lg"
									variant="secondary"
									className="bg-background text-foreground hover:bg-background/90"

								>
									<Link href="/register">
										Start Free Trial
									</Link>
										<IconArrowRight className="ml-2 h-4 w-4" />
								</Button>
							</div>
							<p className="mt-4 text-sm text-primary-foreground/70">
								No credit card required · 14-day free trial
							</p>
						</div>
					</div>
				</section>

				{/* Benefits Section */}
				<section className="py-20 bg-muted/50">
					<div className="container mx-auto px-4">
						<div className="grid items-center gap-12 lg:grid-cols-2">
							<div>
								<h2 className="text-3xl font-bold tracking-tight md:text-4xl">
									Why Choose RentWise?
								</h2>
								<ul className="mt-8 space-y-4">
									{[
										"Save time with automated rent reminders",
										"Never miss a payment with real-time tracking",
										"Secure tenant data and payment information",
										"Access from anywhere — cloud-based platform",
										"Scalable from 1 to 1000+ properties",
									].map((benefit) => (
										<li key={benefit} className="flex items-center gap-3">
											<IconChecklist className="h-5 w-5 text-primary" />
											<span>{benefit}</span>
										</li>
									))}
								</ul>
							</div>
							<div className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 p-8">
								<div className="space-y-6">
									<div className="flex items-center justify-between border-b pb-4">
										<span className="text-muted-foreground">
											Total Properties
										</span>
										<span className="text-2xl font-bold">150+</span>
									</div>
									<div className="flex items-center justify-between border-b pb-4">
										<span className="text-muted-foreground">
											Active Tenants
										</span>
										<span className="text-2xl font-bold">2,400+</span>
									</div>
									<div className="flex items-center justify-between">
										<span className="text-muted-foreground">
											Revenue Collected
										</span>
										<span className="text-2xl font-bold">₹12Cr+</span>
									</div>
								</div>
							</div>
						</div>
					</div>
				</section>
			</main>
		</div>
	);
}
