import { payments } from "@rently/db/schema/schema";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import type z from "zod";

// ******** Payment **********
// ── Layer 1: DB-derived
// Derive Zod Schemas - For Runtime
export const PaymentSelectSchema = createSelectSchema(payments);
export const PaymentInsertSchema = createInsertSchema(payments);

// ── Layer 2: API input schemas
// Business Logic Schemas
export const CreatePaymentSchema = PaymentInsertSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
});

export const UpdatePaymentSchema = createUpdateSchema(payments).pick({
	amount: true,
	paymentDate: true,
	type: true,
	paymentMethods: true,
	referenceNumber: true,
	description: true,
	utilityId: true,
});

// TS Types derieved from Zod (not from InferSelectModel)
export type Payment = z.infer<typeof PaymentSelectSchema>;
export type NewPayment = z.infer<typeof PaymentInsertSchema>;
export type CreatePayment = z.infer<typeof CreatePaymentSchema>;
export type UpdatePayment = z.infer<typeof UpdatePaymentSchema>;
