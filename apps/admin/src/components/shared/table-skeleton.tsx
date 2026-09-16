import { Skeleton } from "@rently/ui/components/skeleton";
import { TableCell, TableRow } from "@rently/ui/components/table";

// Rendered INSIDE an existing <TableBody> — returns rows only. Wrapping this
// in its own <TableBody> nests <tbody> inside <tbody>, which is invalid HTML
// and surfaces as a React hydration error.
export function TableSkeleton({
	columns,
	rows = 5,
}: {
	columns: number;
	rows?: number;
}) {
	return (
		<>
			{Array.from({ length: rows }, (_, row) => (
				<TableRow key={row}>
					{Array.from({ length: columns }, (_, column) => (
						<TableCell key={column}>
							<Skeleton className="h-4 w-full max-w-40" />
						</TableCell>
					))}
				</TableRow>
			))}
		</>
	);
}
