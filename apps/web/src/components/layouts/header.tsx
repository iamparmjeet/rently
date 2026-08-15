"use client";
import { Button } from "@rently/ui/components/button";
import { cn } from "@rently/ui/lib/utils";
import Logo from "@rently/ui/shared/logo";
import { IconMenu, IconX } from "@tabler/icons-react";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { AuthEntryLink } from "@/components/auth/auth-entry-link";

const navLinks = [
	{ href: "/#features", label: "Features" },
	{ href: "/#how-it-works", label: "How It Works" },
	{ href: "/#pricing", label: "Pricing" },
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
							href={link.href as Route}
							className="font-medium text-base text-muted-foreground transition-colors hover:text-foreground"
						>
							{link.label}
						</Link>
					))}
				</div>

				{/* Desktop CTAs */}
				<div className="hidden md:flex md:items-center md:gap-4">
					<Button variant="ghost" className="text-base">
						<AuthEntryLink href="/login">Log in</AuthEntryLink>
					</Button>
					<Button className="px-4 py-6 text-base">
						<AuthEntryLink href="/register" className="">
							Get Started
						</AuthEntryLink>
					</Button>
				</div>

				{/* Mobile Menu Button */}
				<Button
					className="md:hidden"
					onClick={() => setMobileMenuOpen((open) => !open)}
					aria-label="Toggle menu"
					aria-expanded={mobileMenuOpen}
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
					"absolute inset-x-0 top-full z-50 px-4 pt-3 transition-all duration-200 ease-out md:hidden",
					mobileMenuOpen
						? "visible translate-y-0 opacity-100"
						: "pointer-events-none invisible -translate-y-2 opacity-0",
				)}
				aria-hidden={!mobileMenuOpen}
			>
				<div className="container mx-auto max-w-lg rounded-2xl border border-border/70 bg-background p-2 shadow-foreground/10 shadow-xl">
					<div className="flex flex-col gap-1">
						{navLinks.map((link) => (
							<Link
								key={link.href}
								href={link.href as Route}
								className="rounded-xl px-4 py-3 font-medium text-foreground text-sm transition-colors hover:bg-muted"
								onClick={() => setMobileMenuOpen(false)}
							>
								{link.label}
							</Link>
						))}
					</div>
					<div className="mt-2 grid grid-cols-1 gap-2 border-border/70 border-t pt-2">
						<Button
							variant="ghost"
							className="h-11 rounded-md border border-border/70 bg-background text-sm hover:bg-muted"
						>
							<AuthEntryLink href="/login">Log in</AuthEntryLink>
						</Button>
						<Button className="col-span-2 h-11 rounded-md text-sm">
							<AuthEntryLink href="/register">Get Started</AuthEntryLink>
						</Button>
					</div>
				</div>
			</div>
		</header>
	);
}
