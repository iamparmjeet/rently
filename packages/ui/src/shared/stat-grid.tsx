import { Card, CardContent } from "../components/card";
import { cn } from "../lib/utils";
import { IconWrapper } from "./icon-wrapper";

export interface StatItem {
	icon: React.ElementType;
	label: string;
	value: string | number;
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
	isLoading,
}: StatItem & { isLoading?: boolean }) => (
	<Card>
		<CardContent className="flex flex-col items-start gap-4 p-4">
			<IconWrapper>
				<Icon className="size-6 text-primary" />
			</IconWrapper>
			<div>
				<p className="text-muted-foreground text-xs">{label}</p>
				{isLoading ? (
					<div className="mt-1 h-7 w-16 animate-pulse rounded bg-muted" />
				) : (
					<p className="font-semibold text-2xl">{value}</p>
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
