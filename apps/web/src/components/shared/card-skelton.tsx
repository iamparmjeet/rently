// components/shared/card-skeleton.tsx
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
} from "@rently/ui/components/card";
import { Skeleton } from "@rently/ui/components/skeleton";

export function CardSkeleton() {
	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between gap-2">
					<Skeleton className="h-4 w-32" />
					<Skeleton className="h-3 w-24" />
				</div>
			</CardHeader>
			<CardContent className="space-y-3 pb-3">
				<Skeleton className="h-3 w-40" />
				<Skeleton className="h-8 w-28" />
				<Skeleton className="h-3 w-48" />
			</CardContent>
			<CardFooter className="gap-2 pt-0">
				<Skeleton className="h-5 w-16 rounded-full" />
				<Skeleton className="ml-auto h-3 w-24" />
			</CardFooter>
		</Card>
	);
}
