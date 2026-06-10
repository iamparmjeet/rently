import { useClient } from "@rently/hooks/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/utils/orpc";

export function useSubmitReading() {
	const client = useClient();
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Submitting reading...");
			return { toastId };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.tenantPortal.submitMyReading>[0],
		) => client.rent.tenantPortal.submitMyReading(input),
		onSuccess: (_, __, context) => {
			toast.success("Reading submitted!", { id: context?.toastId });
			queryClient.invalidateQueries({
				queryKey: orpc.rent.tenantPortal.getMyUtilities.key(),
			});
		},
		onError: (error, _, context) => {
			if (error.cause === "TOO_MANY_REQUESTS") {
				toast.error(error.message, {
					id: context?.toastId,
					duration: 8000, // longer duration — this is important information
				});
				return;
			}

			if (error.cause === "CONFLICT") {
				// a different tone: this isn't an error, it's informational.
				// The tenant did nothing wrong — a reading already exists.
				toast.info(error.message, { id: context?.toastId, duration: 6000 });
				return;
			}

			toast.error(`Failed to submit: ${error.message}`, {
				id: context?.toastId,
				duration: 10000,
			});
		},
	});
}
