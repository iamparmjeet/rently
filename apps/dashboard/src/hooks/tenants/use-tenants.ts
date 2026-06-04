import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function useTenants() {
	return useQuery(orpc.rent.tenant.listTenants.queryOptions());
}

export function useSuspenseTenants() {
	return useSuspenseQuery(orpc.rent.tenant.listTenants.queryOptions());
}
