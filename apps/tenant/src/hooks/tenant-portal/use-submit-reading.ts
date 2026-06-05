import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/utils/orpc";

export function useSubmitReading() {
	const queryClient = useQueryClient();

	return useMutation({
		...orpc.rent.tenantPortal.submitMyReading.mutationOptions(),
		onSuccess: () => {
			// Invalidate utilities list so Reading tab + Bill tab refresh
			queryClient.invalidateQueries({
				queryKey: orpc.rent.tenantPortal.getMyUtilities.key(),
			});
			toast.success("Reading submitted! Your landlord has been notified.");
		},
		onError: (error) => {
			toast.error(error.message ?? "Failed to submit reading.");
		},
	});
}
