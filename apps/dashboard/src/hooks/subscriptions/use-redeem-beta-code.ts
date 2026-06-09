"use client";

import type { RedeemBetaCodeInput } from "@rently/validators";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { client, orpc } from "@/utils/orpc";

export function useRedeemBetaCode() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Validating code...");
			return { toastId };
		},
		mutationFn: (input: RedeemBetaCodeInput) =>
			client.subscription.redeemBetaCode(input),
		onError: (err, _, context) => {
			toast.error(err instanceof Error ? err.message : "Invalid code", {
				id: context?.toastId,
			});
		},
		onSuccess: (data, _, context) => {
			queryClient.invalidateQueries({
				queryKey: orpc.subscription.getMySubscription.key(),
			});

			toast.success(`${data.planName} plan activated!`, {
				id: context.toastId,
			});
		},
	});
}
