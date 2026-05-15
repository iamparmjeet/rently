import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function useTenants() {
	return useQuery(orpc.rent.tenant.listTenants.queryOptions());
}
