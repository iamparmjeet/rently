"use client";
import { Button } from "@rently/ui/components/button";
import { cn } from "@rently/ui/lib/utils";
import { IconMenu, IconX } from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";
import Logo from "../shared/logo";

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
				<Logo />

				{/* Desktop Navigation */}
				<div className="hidden md:flex md:items-center md:gap-6">
					{navLinks.map((link) => (
						<Link
							key={link.href}
							href={link.href}
							className="font-medium text-muted-foreground text-sm transition-colors hover:text-foreground"
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
					"border-b bg-background md:hidden",
					mobileMenuOpen ? "block" : "hidden",
				)}
			>
				<div className="container mx-auto flex flex-col gap-4 px-4 py-4">
					{navLinks.map((link) => (
						<Link
							key={link.href}
							href={link.href}
							className="font-medium text-muted-foreground text-sm transition-colors hover:text-foreground"
							onClick={() => setMobileMenuOpen(false)}
						>
							{link.label}
						</Link>
					))}
					<div className="flex flex-col gap-2 border-t pt-4">
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
