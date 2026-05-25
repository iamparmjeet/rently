import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

// Single Property By Id
export function useProperty(id: string) {
	return useQuery({
		...orpc.rent.property.getPropertyById.queryOptions({ input: { id } }),
		enabled: !!id,
	});
}

// Suspense
export function useSuspenseProperty(id: string) {
	return useSuspenseQuery(
		orpc.rent.property.getPropertyById.queryOptions({
			input: { id },
		}),
		// No need for enabled id -> cause Suspense queries always run
	);
}
