import {
	IconBuilding,
	IconChartBar,
	IconHome2,
	IconUsers,
} from "@tabler/icons-react";
import { Card, CardContent } from "@/components/ui/card";

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
		<CardContent className="flex items-center gap-3 p-4">
			<div className="rounded-md bg-primary/10 p-2">
				<Icon className="h-4 w-4 text-primary" />
			</div>
			<div>
				<p className="text-muted-foreground text-xs">{label}</p>
				{isLoading ? (
					<div className="h-5 w-16 animate-pulse rounded bg-muted" />
				) : (
					<p className="font-semibold text-lg">{value}</p>
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
				icon={IconHome2}
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
