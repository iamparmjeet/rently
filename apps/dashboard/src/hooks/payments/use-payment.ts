import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function usePayment(id: string) {
	return useQuery({
		...orpc.rent.payment.getPaymentById.queryOptions({ input: { id } }),
		enabled: !!id,
	});
}

export function useSuspensePayment(id: string) {
	return useSuspenseQuery(
		orpc.rent.payment.getPaymentById.queryOptions({ input: { id } }),
	);
}
