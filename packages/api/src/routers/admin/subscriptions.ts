import {
	AdminSubscriptionListInputSchema,
	AdminSubscriptionListResponseSchema,
	RecordSubscriptionPaymentResponseSchema,
	RecordSubscriptionPaymentSchema,
} from "@rently/validators";
import {
	queryAdminSubscriptions,
	recordSubscriptionPayment,
} from "../../modules/admin/subscriptions";
import { adminProcedure } from "../../procedures";

export const list = adminProcedure
	.route({ method: "GET", path: "/admin/subscriptions" })
	.input(AdminSubscriptionListInputSchema)
	.output(AdminSubscriptionListResponseSchema)
	.handler(({ context, input }) => queryAdminSubscriptions(context.db, input));

export const recordPayment = adminProcedure
	.route({ method: "POST", path: "/admin/subscriptions/payment" })
	.input(RecordSubscriptionPaymentSchema)
	.output(RecordSubscriptionPaymentResponseSchema)
	.handler(({ context, input }) =>
		recordSubscriptionPayment(context.db, context.user.id, input),
	);
