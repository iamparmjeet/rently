import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function useLeases() {
	return useQuery(orpc.rent.lease.listLease.queryOptions());
}
