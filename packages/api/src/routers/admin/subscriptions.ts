import {
	AdminInvoiceListResponseSchema,
	AdminPaginationSchema,
	AdminSubscriptionListInputSchema,
	AdminSubscriptionListResponseSchema,
	CancelSubscriptionResponseSchema,
	CancelSubscriptionSchema,
	RecordSubscriptionPaymentResponseSchema,
	RecordSubscriptionPaymentSchema,
} from "@rently/validators";
import {
	cancelSubscription,
	queryAdminOutstandingInvoices,
	queryAdminSubscriptions,
	recordSubscriptionPayment,
} from "../../modules/admin/subscriptions";
import { adminProcedure } from "../../procedures";

export const list = adminProcedure
	.route({ method: "GET", path: "/admin/subscriptions" })
	.input(AdminSubscriptionListInputSchema)
	.output(AdminSubscriptionListResponseSchema)
	.handler(({ context, input }) => queryAdminSubscriptions(context.db, input));

export const listOutstandingInvoices = adminProcedure
	.route({ method: "GET", path: "/admin/subscriptions/outstanding-invoices" })
	.input(AdminPaginationSchema)
	.output(AdminInvoiceListResponseSchema)
	.handler(({ context, input }) =>
		queryAdminOutstandingInvoices(context.db, input),
	);

export const recordPayment = adminProcedure
	.route({ method: "POST", path: "/admin/subscriptions/payment" })
	.input(RecordSubscriptionPaymentSchema)
	.output(RecordSubscriptionPaymentResponseSchema)
	.handler(({ context, input }) =>
		recordSubscriptionPayment(context.db, context.user.id, input),
	);

export const cancel = adminProcedure
	.route({ method: "POST", path: "/admin/subscriptions/cancel" })
	.input(CancelSubscriptionSchema)
	.output(CancelSubscriptionResponseSchema)
	.handler(({ context, input }) =>
		cancelSubscription(context.db, context.user.id, input),
	);
