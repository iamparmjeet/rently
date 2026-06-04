import type { Icon } from "@tabler/icons-react";
import { IconArrowUpRight } from "@tabler/icons-react";
import Link from "next/link";
import { StatNumber } from "./stat-number";

type StatCardVariant = "default" | "accent";

interface StatCardProps {
	icon: Icon;
	value: number;
	label: string;
	href: string;
	isLoading: boolean;

	variant?: StatCardVariant;

	className?: string;
}

export function StatCard({
	icon: Icon,
	value,
	label,
	href,
	isLoading,
	variant = "default",
	className = "",
}: StatCardProps) {
	const isAccent = variant === "accent";

	return (
		<div
			className={`relative overflow-hidden rounded-2xl p-6 ${
				isAccent
					? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
					: "border border-border/40 bg-card shadow-sm"
			} ${className}`}
		>
			{/* Decorative geometry — colour shifts with variant */}
			<div
				className={`pointer-events-none absolute -top-7 -right-7 size-32 rounded-full ${
					isAccent ? "bg-white/8" : "bg-primary/5"
				}`}
			/>
			<div
				className={`pointer-events-none absolute -top-2 -right-2 size-16 rounded-full ${
					isAccent ? "bg-white/5" : "bg-primary/8"
				}`}
			/>

			<div className="relative flex items-start justify-between">
				<div
					className={`rounded-xl p-2.5 ${
						isAccent ? "bg-white/15" : "bg-primary/10"
					}`}
				>
					<Icon
						className={`size-5 ${isAccent ? "text-primary-foreground" : "text-primary"}`}
					/>
				</div>
				<Link
					href={href}
					className={`flex items-center gap-1 text-xs transition-colors ${
						isAccent
							? "text-primary-foreground/70 hover:text-primary-foreground"
							: "text-muted-foreground hover:text-foreground"
					}`}
				>
					View all
					<IconArrowUpRight className="size-3" />
				</Link>
			</div>

			<div className="relative mt-5">
				<p
					className={`mt-1.5 font-medium text-sm ${
						isAccent ? "opacity-75" : "text-muted-foreground"
					}`}
				>
					{label}
				</p>
				<StatNumber value={value} isLoading={isLoading} inverted={isAccent} />
			</div>
		</div>
	);
}
