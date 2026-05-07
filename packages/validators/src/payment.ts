import { PAYMENT_TYPE_VALUES } from "@rently/db/constants/rent-constants";
import z from "zod";

export const PaymentSchema = z.object({
	id: z.uuid(),
	leaseId: z.uuid(),
	amount: z.number().positive(),
	paymentDate: z.date(),
	type: z.enum(PAYMENT_TYPE_VALUES),
	description: z.string().optional().nullable(),
	utilityId: z.uuid().optional().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const CreatePaymentSchema = PaymentSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
});

export const UpdatePaymentSchema = PaymentSchema.partial().pick({
	leaseId: true,
	amount: true,
	paymentDate: true,
	type: true,
	description: true,
	utilityId: true,
});
