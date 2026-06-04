import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function useLease(id: string) {
	return useQuery({
		...orpc.rent.lease.getLeaseById.queryOptions({
			input: { id },
		}),
		enabled: !!id,
	});
}

// Suspense enabled
export function useSuspenseLease(id: string) {
	return useSuspenseQuery(
		orpc.rent.lease.getLeaseById.queryOptions({
			input: { id },
		}),
	);
}
