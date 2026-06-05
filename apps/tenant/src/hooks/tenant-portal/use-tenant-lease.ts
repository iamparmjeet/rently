import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function useTenantLease() {
	return useQuery(orpc.rent.tenantPortal.getMyActiveLease.queryOptions());
}
