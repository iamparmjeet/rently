// src/components/layouts/footer.tsx

import {
	IconBrandGithub,
	IconBrandTwitter,
	IconBuilding,
} from "@tabler/icons-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const footerLinks = {
	product: [
		{ label: "Features", href: "#features" },
		{ label: "Pricing", href: "#pricing" },
		{ label: "How It Works", href: "#how-it-works" },
	],
	company: [
		{ label: "About", href: "/about" },
		{ label: "Blog", href: "/blog" },
		{ label: "Careers", href: "/careers" },
	],
	legal: [
		{ label: "Privacy Policy", href: "/privacy" },
		{ label: "Terms of Service", href: "/terms" },
		{ label: "Cookie Policy", href: "/cookie" },
	],
};

export function Footer() {
	return (
		<footer className="border-t bg-muted/50">
			<div className="container mx-auto px-4 py-12">
				<div className="grid gap-8 md:grid-cols-4">
					{/* Brand */}
					<div className="flex flex-col gap-4">
						<Link href="/" className="flex items-center gap-2">
							<IconBuilding className="h-6 w-6 text-primary" />
							<span className="text-xl font-semibold">RentWise</span>
						</Link>
						<p className="text-sm text-muted-foreground">
							Simplify your property management with smart tenant tracking,
							automated rent collection, and comprehensive utilities management.
						</p>
						<div className="flex gap-4">
							<Button variant="ghost" size="icon">
								<a href="#" aria-label="Twitter">
									<IconBrandTwitter className="h-4 w-4" />
								</a>
							</Button>
							<Button variant="ghost" size="icon">
								<a href="#" aria-label="GitHub">
									<IconBrandGithub className="h-4 w-4" />
								</a>
							</Button>
						</div>
					</div>

					{/* Links */}
					<div>
						<h3 className="mb-4 text-sm font-semibold">Product</h3>
						<ul className="space-y-2">
							{footerLinks.product.map((link) => (
								<li key={link.href}>
									<Link
										href={link.href}
										className="text-sm text-muted-foreground transition-colors hover:text-foreground"
									>
										{link.label}
									</Link>
								</li>
							))}
						</ul>
					</div>

					<div>
						<h3 className="mb-4 text-sm font-semibold">Company</h3>
						<ul className="space-y-2">
							{footerLinks.company.map((link) => (
								<li key={link.href}>
									<Link
										href={link.href}
										className="text-sm text-muted-foreground transition-colors hover:text-foreground"
									>
										{link.label}
									</Link>
								</li>
							))}
						</ul>
					</div>

					<div>
						<h3 className="mb-4 text-sm font-semibold">Legal</h3>
						<ul className="space-y-2">
							{footerLinks.legal.map((link) => (
								<li key={link.href}>
									<Link
										href={link.href}
										className="text-sm text-muted-foreground transition-colors hover:text-foreground"
									>
										{link.label}
									</Link>
								</li>
							))}
						</ul>
					</div>
				</div>

				<div className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
					<p>
						&copy; {new Date().getFullYear()} RentWise. All rights reserved. | Made with ♡ by <Link target="_blank" href={"https://parmjeetmishra.com"}>Parm</Link>
					</p>
				</div>
			</div>
		</footer>
	);
}
