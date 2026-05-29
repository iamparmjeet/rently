import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

// List All utilities
export function useUtilities() {
	return useQuery(orpc.rent.utility.listUtilities.queryOptions({ input: {} }));
}

// Why: LeaseScope variant
export function useLeaseUtilities(leaseId: string) {
	return useQuery({
		...orpc.rent.utility.listUtilities.queryOptions({
			input: { leaseId },
		}),
		enabled: !!leaseId,
	});
}

// Suspense
export function useSuspenseUtilities() {
	return useSuspenseQuery(
		orpc.rent.utility.listUtilities.queryOptions({ input: {} }),
	);
}
