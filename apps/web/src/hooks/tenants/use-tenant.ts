import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function useTenant(id: string) {
	return useQuery({
		...orpc.rent.tenant.getTenantById.queryOptions({
			input: { id },
		}),
		enabled: !!id,
	});
}
