import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

// List All Units
export function useUnits() {
	return useQuery(orpc.rent.unit.listUnits.queryOptions({ input: {} }));
}

export function usePropertyUnits(propertyId: string) {
	return useQuery({
		...orpc.rent.unit.listUnits.queryOptions({
			input: { propertyId },
		}),
		enabled: !!propertyId,
	});
}
