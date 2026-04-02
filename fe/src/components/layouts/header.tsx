"use client"
import { IconBuilding, IconMenu, IconX } from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
	{ href: "#features", label: "Features" },
	{ href: "#how-it-works", label: "How It Works" },
	{ href: "#pricing", label: "Pricing" },
];

export function Header() {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	return (
		<header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
			<nav className="container mx-auto flex h-16 items-center justify-between px-4">
				{/* Logo */}
				<Link href="/" className="flex items-center gap-2">
					<IconBuilding className="h-6 w-6 text-primary" />
					<span className="text-xl font-semibold">RentWise</span>
				</Link>

				{/* Desktop Navigation */}
				<div className="hidden md:flex md:items-center md:gap-6">
					{navLinks.map((link) => (
						<Link
							key={link.href}
							href={link.href}
							className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
						>
							{link.label}
						</Link>
					))}
				</div>

				{/* Desktop CTAs */}
				<div className="hidden md:flex md:items-center md:gap-4">
					<Button variant="ghost">
						<Link href="/login">Log in</Link>
					</Button>
					<Button>
						<Link href="/register">Get Started</Link>
					</Button>
				</div>

				{/* Mobile Menu Button */}
				<Button
					className="md:hidden"
					onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
					aria-label="Toggle menu"
				>
					{mobileMenuOpen ? (
						<IconX className="h-6 w-6" />
					) : (
						<IconMenu className="h-6 w-6" />
					)}
				</Button>
			</nav>

			{/* Mobile Menu */}
			<div
				className={cn(
					"md:hidden border-b bg-background",
					mobileMenuOpen ? "block" : "hidden",
				)}
			>
				<div className="container mx-auto px-4 py-4 flex flex-col gap-4">
					{navLinks.map((link) => (
						<Link
							key={link.href}
							href={link.href}
							className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
							onClick={() => setMobileMenuOpen(false)}
						>
							{link.label}
						</Link>
					))}
					<div className="flex flex-col gap-2 pt-4 border-t">
						<Button variant="ghost">
							<Link href="/login">Log in</Link>
						</Button>
						<Button>
							<Link href="/register">Get Started</Link>
						</Button>
					</div>
				</div>
			</div>
		</header>
	);
}
