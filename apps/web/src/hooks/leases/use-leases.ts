import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function useLeases() {
	return useQuery(orpc.rent.lease.listLeases.queryOptions());
}

export function useSuspenseLeases() {
	return useSuspenseQuery(orpc.rent.lease.listLeases.queryOptions());
}
