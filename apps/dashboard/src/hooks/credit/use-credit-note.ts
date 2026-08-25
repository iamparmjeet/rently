import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function useCreditNote(creditId: string) {
	return useQuery({
		...orpc.rent.credit.getCreditNote.queryOptions({
			input: { creditId },
		}),
		enabled: !!creditId,
	});
}
