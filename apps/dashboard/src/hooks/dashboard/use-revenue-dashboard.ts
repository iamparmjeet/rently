import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function useRevenueDashboard() {
	return useQuery({
		...orpc.rent.stats.getRevenueDashboard.queryOptions(),
		staleTime: 30_000_0,
	});
}

export function useSuspenseRevenueDashboard() {
	return useSuspenseQuery({
		...orpc.rent.stats.getRevenueDashboard.queryOptions(),
		staleTime: 30_000_0,
	});
}
