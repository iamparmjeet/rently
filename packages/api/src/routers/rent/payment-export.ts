import { ORPCError } from "@orpc/server";
import { ownerProcedure } from "@rently/api/procedures";
import {
	OwnerPaymentExportSchema,
	PaymentExportOutputSchema,
	type PaymentExportRow,
	TenantPaymentExportSchema,
} from "@rently/validators";
import {
	PAYMENT_EXPORT_MAX_ROWS,
	queryOwnerPaymentExportRows,
	queryTenantPaymentExportRows,
} from "../helpers/payment-export-query";

function assertExportWithinLimit(rows: PaymentExportRow[]): void {
	if (rows.length <= PAYMENT_EXPORT_MAX_ROWS) {
		return;
	}

	throw new ORPCError("BAD_REQUEST", {
		message:
			"This export contains more than 10,000 payments. Narrow the date range and try again.",
	});
}

export const exportOwnerPayments = ownerProcedure
	.route({
		method: "POST",
		path: "/rent/payment/export",
	})
	.input(OwnerPaymentExportSchema)
	.output(PaymentExportOutputSchema)
	.handler(async ({ context, input }) => {
		const rows = await queryOwnerPaymentExportRows(
			context.db,
			context.user.id,
			input,
		);

		assertExportWithinLimit(rows);

		return {
			payments: rows,
		};
	});

export const exportTenantPayments = ownerProcedure
	.route({
		method: "POST",
		path: "/rent/payment/export-tenant",
	})
	.input(TenantPaymentExportSchema)
	.output(PaymentExportOutputSchema)
	.handler(async ({ context, input }) => {
		const rows = await queryTenantPaymentExportRows(
			context.db,
			context.user.id,
			input.tenantId,
		);

		assertExportWithinLimit(rows);

		return {
			payments: rows,
		};
	});
