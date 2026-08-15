import type { DateRange } from "@rently/ui/lib/date";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	downloadCsv,
	formatOwnerPaymentExportFilename,
	formatTenantPaymentExportFilename,
	paymentExportRowsToCsv,
} from "@/lib/payment-csv";
import { client } from "@/utils/orpc";

interface TenantPaymentExportVariables {
	tenantId: string;
	tenantName: string;
}

export function useOwnerPaymentExport() {
	return useMutation({
		mutationFn: (range: DateRange) =>
			client.rent.payment.exportOwnerPayments(range),

		onSuccess: (result, range) => {
			if (result.payments.length === 0) {
				toast.info("No payments found for this export.");
				return;
			}

			downloadCsv(
				paymentExportRowsToCsv(result.payments),
				formatOwnerPaymentExportFilename(range),
			);

			toast.success("Payment CSV downloaded.");
		},

		onError: (error) => {
			toast.error(`Failed to export payments: ${error.message}`);
		},
	});
}

export function useTenantPaymentExport() {
	return useMutation({
		mutationFn: ({ tenantId }: TenantPaymentExportVariables) =>
			client.rent.payment.exportTenantPayments({
				tenantId,
			}),

		onSuccess: (result, variables) => {
			if (result.payments.length === 0) {
				toast.info("No payments found for this export.");
				return;
			}

			downloadCsv(
				paymentExportRowsToCsv(result.payments),
				formatTenantPaymentExportFilename(variables.tenantName),
			);

			toast.success("Tenant payment CSV downloaded.");
		},

		onError: (error) => {
			toast.error(`Failed to export tenant payments: ${error.message}`);
		},
	});
}
