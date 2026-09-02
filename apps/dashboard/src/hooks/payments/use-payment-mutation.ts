import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { client, orpc } from "@/utils/orpc";

// WHY: typed alias avoids repeating the long ReturnType expression
type PaymentListData = Awaited<
	ReturnType<typeof client.rent.payment.listPayments>
>;

export function useRecordPayment() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Recording payment...");
			return { toastId };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.payment.createPayment>[0],
		) => client.rent.payment.createPayment(input),
		onSuccess: (_, __, context) => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.payment.listPayments.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.stats.getRevenueDashboard.key(),
			});
			toast.success("Payment recorded", { id: context.toastId });
		},
		onError: (error, _, context) => {
			toast.error(`Failed to record payment: ${error.message}`, {
				id: context?.toastId,
			});
		},
	});
}

export function useRecordAgreementPayment() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (
			input: Parameters<typeof client.rent.payment.createAgreementPayment>[0],
		) => client.rent.payment.createAgreementPayment(input),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.rent.payment.listPayments.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.stats.getRevenueDashboard.key(),
			});
			toast.success("Combined payment recorded");
		},
		onError: (error) =>
			toast.error(`Failed to record combined payment: ${error.message}`),
	});
}

export function useUpdatePayment() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Updating payment...");
			return { toastId };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.payment.updatePayment>[0],
		) => client.rent.payment.updatePayment(input),
		onSuccess: (_, variables, context) => {
			// Invalidate both the list and the specific item
			queryClient.invalidateQueries({
				queryKey: orpc.rent.payment.listPayments.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.payment.getPaymentById.key({
					input: { id: variables.id },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.stats.getRevenueDashboard.key(),
			});
			toast.success("Payment updated", { id: context.toastId });
		},
		onError: (error, _, context) => {
			toast.error(`Failed to update: ${error.message}`, {
				id: context?.toastId,
			});
		},
	});
}

export function useDeletePayment() {
	const queryClient = useQueryClient();

	return useMutation({
		onMutate: async (variables) => {
			const toastId = toast.loading("Deleting payment...");

			await queryClient.cancelQueries({
				queryKey: orpc.rent.payment.listPayments.key(),
			});

			const prevList = queryClient.getQueryData<PaymentListData>(
				orpc.rent.payment.listPayments.key(),
			);

			// Optimistic removal
			queryClient.setQueryData<PaymentListData>(
				orpc.rent.payment.listPayments.key(),
				(old) => {
					if (!old) return old;
					return {
						...old,
						payments: old.payments.filter((p) => p.id !== variables.id),
					};
				},
			);

			return { toastId, prevList };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.payment.voidPayment>[0],
		) => client.rent.payment.voidPayment(input),
		onError: (error, _, context) => {
			if (context?.prevList !== undefined) {
				queryClient.setQueryData(
					orpc.rent.payment.listPayments.key(),
					context.prevList,
				);
			}
			toast.error(`Failed to delete: ${error.message}`, {
				id: context?.toastId,
			});
		},
		onSuccess: (_, __, context) => {
			toast.success("Payment deleted", { id: context.toastId });
		},
		onSettled: () => {
			// WHY: removeQueries on delete — no refetch needed, data is gone
			queryClient.invalidateQueries({
				queryKey: orpc.rent.payment.listPayments.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.rent.stats.getRevenueDashboard.key(),
			});
		},
	});
}

export function useSendPaymentReceipt() {
	return useMutation({
		onMutate: () => {
			const toastId = toast.loading("Sending receipt…");
			return { toastId };
		},
		mutationFn: (
			input: Parameters<typeof client.rent.payment.sendPaymentReceipt>[0],
		) => client.rent.payment.sendPaymentReceipt(input),
		onSuccess: (_, __, context) => {
			toast.success("Receipt sent to tenant", { id: context.toastId });
		},
		onError: (error, _, context) => {
			toast.error(`Failed to send receipt: ${error.message}`, {
				id: context?.toastId,
			});
		},
	});
}
