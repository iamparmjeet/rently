import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function useUtility(id: string) {
	return useQuery({
		...orpc.rent.utility.getUtilityById.queryOptions({
			input: { id },
		}),
		enabled: !!id,
	});
}

export function useSuspenseUtility(id: string) {
	return useSuspenseQuery(
		orpc.rent.utility.getUtilityById.queryOptions({
			input: { id },
		}),
	);
}
