import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { client, orpc } from "@/utils/orpc";

export function useCreateCredit() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (
			input: Parameters<typeof client.rent.credit.createCredit>[0],
		) => client.rent.credit.createCredit(input),
		onSuccess: (data) => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.credit.listCredits.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.utility.listUtilities.key(),
			});
			if (data?.credit?.utilityId) {
				queryClient.invalidateQueries({
					queryKey: orpc.rent.credit.getCreditNote.key({
						input: { creditId: data.credit.id },
					}),
				});
			}
			if (data?.credit?.creditNoteNo) {
				toast.success(`Credit ${data.credit.creditNoteNo} created`);
			} else {
				toast.success("Credit created");
			}
		},
		onError: (error) => {
			toast.error(`Failed to create credit: ${error.message}`);
		},
	});
}

export function useListCredits(filters?: {
	leaseId?: string;
	utilityId?: string | null;
}) {
	// helper for invalidation only — list is fetched via separate query where needed
	return { filters };
}
