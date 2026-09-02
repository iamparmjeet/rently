import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function useTenantAgreements() {
	return useQuery(orpc.rent.tenantPortal.getMyAgreements.queryOptions());
}
