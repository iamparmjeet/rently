import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function useUnit(id: string) {
	return useQuery({
		...orpc.rent.unit.getUnitById.queryOptions({ input: { id } }),
		enabled: !!id,
	});
}
