import { payments } from "@rently/db/schema/schema";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type z from "zod";

// ******** Payment **********

// Derive Zod Schemas - For Runtime
export const PaymentSelectSchema = createSelectSchema(payments);
export const PaymentInsertSchema = createInsertSchema(payments);

// Business Logic Schemas

export const CreatePaymentSchema = PaymentInsertSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
});

export const UpdatePaymentSchema = PaymentSelectSchema.partial().pick({
	leaseId: true,
	amount: true,
	paymentDate: true,
	type: true,
	description: true,
	utilityId: true,
});

// TS Types derieved from Zod (not from InferSelectModel)
export type Payment = z.infer<typeof PaymentSelectSchema>;
export type NewPayment = z.infer<typeof PaymentInsertSchema>;
