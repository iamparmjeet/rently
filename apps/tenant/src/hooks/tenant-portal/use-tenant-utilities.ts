import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function useTenantUtilities() {
	return useQuery(orpc.rent.tenantPortal.getMyUtilities.queryOptions());
}
