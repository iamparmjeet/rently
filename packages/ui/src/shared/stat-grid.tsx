import { Card, CardContent } from "../components/card";
import { cn } from "../lib/utils";
import { IconWrapper } from "./icon-wrapper";

export interface StatItem {
	icon: React.ElementType;
	label: string;
	value: string | number;
	// Optional supporting line (e.g. "12 joined in 30 days"). Kept out of the
	// value so the big number stays scannable.
	detail?: string;
}

interface StatsGridProps {
	stats: StatItem[];
	isLoading?: boolean;
	className?: string;
}

const StatCard = ({
	icon: Icon,
	label,
	value,
	detail,
	isLoading,
}: StatItem & { isLoading?: boolean }) => (
	<Card>
		<CardContent className="flex flex-col items-start gap-4 p-4">
			<IconWrapper>
				<Icon className="size-6 text-primary" />
			</IconWrapper>
			{/* A 2-up grid on a 375px viewport leaves ~133px of content width; a
			    long currency value like ₹9,76,700.00 overflows it. Step the size
			    down on mobile and allow an unbreakable number to wrap. */}
			<div className="min-w-0">
				<p className="text-muted-foreground text-xs">{label}</p>
				{isLoading ? (
					<div className="mt-1 h-7 w-16 animate-pulse rounded bg-muted" />
				) : (
					<p className="font-semibold text-xl [overflow-wrap:anywhere] sm:text-2xl">
						{value}
					</p>
				)}
				{detail && (
					<p className="mt-0.5 text-muted-foreground text-xs">{detail}</p>
				)}
			</div>
		</CardContent>
	</Card>
);

export function StatsGrid({ stats, isLoading, className }: StatsGridProps) {
	return (
		<div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4", className)}>
			{stats.map((stat) => (
				<StatCard key={stat.label} {...stat} isLoading={isLoading} />
			))}
		</div>
	);
}
