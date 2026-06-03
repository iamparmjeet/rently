import type { LeaseStatus } from "@rently/db/constants/rent-constants";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function useLeases(status?: LeaseStatus) {
	return useQuery(
		orpc.rent.lease.listLeases.queryOptions({ input: { status } }),
	);
}

export function useSuspenseLeases(status?: LeaseStatus) {
	return useSuspenseQuery(
		orpc.rent.lease.listLeases.queryOptions({ input: { status } }),
	);
}
