import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

// Single Property By Id
export function useProperty(id: string) {
	return useQuery({
		...orpc.rent.property.getPropertyById.queryOptions({ input: { id } }),
		enabled: !!id,
	});
}

export function usePropertyUnits(id: string) {
	return useQuery({
		...orpc.rent.property.getPropertyById.queryOptions({ input: { id } }),
		enabled: !!id,
		select: (data) => data.property,
	});
}
