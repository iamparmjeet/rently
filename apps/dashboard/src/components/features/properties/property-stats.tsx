import { Card, CardContent } from "@rently/ui/components/card";
import {
	IconBuilding,
	IconChartBar,
	IconLayoutBoard,
	IconUsers,
} from "@tabler/icons-react";
import { IconWrapper } from "@/components/shared/icon-wrapper";

interface PropertyStatsProps {
	totalProperties: number;
	totalUnits: number;
	occupiedUnits: number;
	monthlyRevenue: number;
	isLoading?: boolean;
}

const Stat = ({
	icon: Icon,
	label,
	value,
	isLoading,
}: {
	icon: React.ElementType;
	label: string;
	value: string | number;
	isLoading?: boolean;
}) => (
	<Card>
		<CardContent className="flex flex-col items-start gap-4 p-4">
			<IconWrapper>
				<Icon className="size-6 text-primary" />
			</IconWrapper>
			<div>
				<p className="text-muted-foreground text-xs">{label}</p>
				{isLoading ? (
					<div className="size-5 animate-pulse rounded bg-muted" />
				) : (
					<p className="font-semibold text-2xl">{value}</p>
				)}
			</div>
		</CardContent>
	</Card>
);

export function PropertyStats({
	totalProperties,
	totalUnits,
	occupiedUnits,
	monthlyRevenue,
	isLoading,
}: PropertyStatsProps) {
	const occupancyRate =
		totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

	return (
		<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
			<Stat
				icon={IconBuilding}
				label="Properties"
				value={totalProperties}
				isLoading={isLoading}
			/>
			<Stat
				icon={IconLayoutBoard}
				label="Total Units"
				value={totalUnits}
				isLoading={isLoading}
			/>
			<Stat
				icon={IconUsers}
				label="Occupancy"
				value={`${occupancyRate}%`}
				isLoading={isLoading}
			/>
			<Stat
				icon={IconChartBar}
				label="Monthly Revenue"
				value={`₹${monthlyRevenue.toLocaleString("en-IN")}`}
				isLoading={isLoading}
			/>
		</div>
	);
}
