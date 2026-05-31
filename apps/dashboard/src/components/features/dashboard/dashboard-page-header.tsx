"use client";

import { IconPlus } from "@tabler/icons-react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";

interface DashboardHeaderProps {
	className?: string;
}

export function DashboardPageHeader({ className = "" }: DashboardHeaderProps) {
	const { data: session } = useSession();

	const today = new Date().toLocaleDateString("en-IN", {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
	});

	return (
		<div className={`flex flex-row items-start justify-between ${className}`}>
			<div>
				<h1 className="mt-1 font-semibold text-2xl tracking-tight">
					Hi, {session?.user.name}
				</h1>
				<p className="text-muted-foreground text-sm">
					{today}, Here's your portfolio overview
				</p>
			</div>
			<Link
				href="/properties/new"
				className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
			>
				<IconPlus className="size-4" />
				New Property
			</Link>
		</div>
	);
}
