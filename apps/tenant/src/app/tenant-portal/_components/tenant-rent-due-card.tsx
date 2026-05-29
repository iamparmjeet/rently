// src/app/(tenant-portal)/tenant-portal/_components/tenant-rent-due-card.tsx

import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import {
	IconAlertCircle,
	IconCircleCheck,
	IconClock,
} from "@tabler/icons-react";

interface TenantRentDueCardProps {
	nextDueDate: Date | null;
	amount: number | null;
	isLoading: boolean;
}

function getDaysUntil(date: Date): number {
	const now = new Date();
	const diff = date.getTime() - now.getTime();
	return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function TenantRentDueCard({
	nextDueDate,
	amount,
	isLoading,
}: TenantRentDueCardProps) {
	if (isLoading) {
		return (
			<Card>
				<CardContent className="py-6 text-center text-muted-foreground text-sm">
					Loading payment info…
				</CardContent>
			</Card>
		);
	}

	if (!nextDueDate || !amount) {
		return (
			<Card>
				<CardContent className="py-6 text-center text-muted-foreground text-sm">
					No upcoming payments.
				</CardContent>
			</Card>
		);
	}

	const daysUntil = getDaysUntil(nextDueDate);
	const isOverdue = daysUntil < 0;
	const isDueSoon = daysUntil >= 0 && daysUntil <= 5;

	return (
		<Card
			className={
				isOverdue
					? "border-destructive/40 bg-destructive/5"
					: isDueSoon
						? "border-amber-300/60 bg-amber-50/50"
						: ""
			}
		>
			<CardHeader className="pb-3">
				<CardTitle className="flex items-center gap-2 text-base">
					{isOverdue ? (
						<IconAlertCircle className="h-4 w-4 text-destructive" />
					) : isDueSoon ? (
						<IconClock className="h-4 w-4 text-amber-600" />
					) : (
						<IconCircleCheck className="h-4 w-4 text-emerald-600" />
					)}
					Next Rent Payment
				</CardTitle>
			</CardHeader>

			<CardContent className="flex items-end justify-between">
				<div>
					<p className="font-bold text-3xl">
						₹{amount.toLocaleString("en-IN")}
					</p>
					<p className="mt-1 text-muted-foreground text-sm">
						Due on{" "}
						{nextDueDate.toLocaleDateString("en-IN", {
							day: "numeric",
							month: "long",
							year: "numeric",
						})}
					</p>
				</div>

				{/* Days pill */}
				<span
					className={`rounded-full px-3 py-1 font-medium text-sm ${
						isOverdue
							? "bg-destructive/10 text-destructive"
							: isDueSoon
								? "bg-amber-100 text-amber-700"
								: "bg-emerald-100 text-emerald-700"
					}`}
				>
					{isOverdue
						? `${Math.abs(daysUntil)}d overdue`
						: daysUntil === 0
							? "Due today"
							: `${daysUntil}d left`}
				</span>
			</CardContent>
		</Card>
	);
}
