import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function useTenantProfile() {
	return useQuery(orpc.rent.tenantPortal.getMyProfile.queryOptions());
}
