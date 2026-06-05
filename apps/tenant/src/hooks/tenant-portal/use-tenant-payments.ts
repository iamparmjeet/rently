import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function useTenantPayments() {
	return useQuery(orpc.rent.tenantPortal.getMyPayments.queryOptions());
}
