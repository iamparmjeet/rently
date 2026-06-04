import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function usePayments() {
	return useQuery(orpc.rent.payment.listPayments.queryOptions());
}

export function useSuspensePayments() {
	return useSuspenseQuery(orpc.rent.payment.listPayments.queryOptions());
}
