import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function useTenantPayments() {
	return useQuery(orpc.rent.tenantPortal.getMyPayments.queryOptions());
}

export function useMyPaymentReceipt(paymentId: string) {
	return useQuery({
		...orpc.rent.tenantPortal.getMyPaymentReceiptData.queryOptions({
			input: { paymentId },
		}),
		enabled: !!paymentId,
	});
}
