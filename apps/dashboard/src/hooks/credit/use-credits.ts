import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function useCredits(filters?: {
	leaseId?: string;
	utilityId?: string | null;
}) {
	return useQuery(
		orpc.rent.credit.listCredits.queryOptions({
			input: filters ?? {},
		}),
	);
}
