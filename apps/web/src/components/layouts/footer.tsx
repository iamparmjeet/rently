import { Year } from "@rently/ui/lib/date";
import Logo from "@rently/ui/shared/logo";
import type { Route } from "next";
import Link from "next/link";

const footerLinks = {
	product: [
		{ label: "Features", href: "#features" },
		{ label: "Pricing", href: "#pricing" },
		{ label: "How It Works", href: "#how-it-works" },
	],
	legal: [
		{ label: "Privacy Policy", href: "/privacy" },
		{ label: "Terms of Service", href: "/terms" },
		{ label: "Cookie Policy", href: "/cookie" },
	],
};

export function Footer() {
	return (
		<footer className="mt-auto border-t bg-muted/50">
			<div className="container mx-auto px-4 py-12">
				<div className="grid gap-8 md:grid-cols-3">
					{/* Brand */}
					<div className="flex flex-col gap-4">
						<Logo />
						<p className="text-muted-foreground text-sm">
							Property, tenant, payment, and utility management for Indian
							landlords.
						</p>
					</div>

					{/* Links */}
					<div>
						<h3 className="mb-4 font-semibold text-sm">Product</h3>
						<ul className="space-y-2">
							{footerLinks.product.map((link) => (
								<li key={link.href}>
									<Link
										href={link.href as Route}
										className="text-muted-foreground text-sm transition-colors hover:text-foreground"
									>
										{link.label}
									</Link>
								</li>
							))}
						</ul>
					</div>

					<div>
						<h3 className="mb-4 font-semibold text-sm">Legal</h3>
						<ul className="space-y-2">
							{footerLinks.legal.map((link) => (
								<li key={link.href}>
									<Link
										href={link.href as Route}
										className="text-muted-foreground text-sm transition-colors hover:text-foreground"
									>
										{link.label}
									</Link>
								</li>
							))}
						</ul>
					</div>
				</div>

				<div className="mt-12 border-t pt-8 text-center text-muted-foreground text-sm">
					<p>
						&copy; {Year()} KeyHQ. All rights reserved. | Made with ♡ by{" "}
						<Link target="_blank" href={"https://parmjeetmishra.com"}>
							Parm
						</Link>
					</p>
				</div>
			</div>
		</footer>
	);
}
