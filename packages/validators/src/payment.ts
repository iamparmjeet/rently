import { PAYMENT_METHOD_VALUES } from "@rently/db/constants/payment-constants";
import { PAYMENT_TYPE_VALUES } from "@rently/db/constants/rent-constants";

import { payments } from "@rently/db/schema/schema";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import z from "zod";

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

export const RecordUtilityPaymentSchema = z.object({
	utilityId: z.uuid(),
	leaseId: z.uuid(),
	amount: z.number().min(1, { error: "Amount required" }),
	paymentMethod: z.enum(PAYMENT_METHOD_VALUES),
	receivedAt: z.string().min(1, { error: "Date Required" }),
	notes: z.string().optional(),
});

export const PaymentListItemSchema = PaymentSelectSchema.extend({
	tenantName: z.string().nullable(),
	tenantPhone: z.string().nullable(),
});

// ********* Payment Export **********
/**
 * A date-only API value.
 *
 * z.iso.date() accepts real YYYY-MM-DD calendar dates and rejects:
 * - malformed values such as 2026-8-1
 * - impossible dates such as 2026-02-30
 *
 * It deliberately returns a string, not a JavaScript Date.
 */
export const DateOnlySchema = z.iso.date({
	error: "Expected a valid date in YYYY-MM-DD format.",
});

/**
 * Input for an owner-wide payment export.
 *
 * Lexicographical comparison works because both values are guaranteed
 * to use the fixed-width YYYY-MM-DD format.
 */
export const PaymentExportRangeSchema = z
	.object({
		startDate: DateOnlySchema,
		endDate: DateOnlySchema,
	})
	.refine(({ startDate, endDate }) => startDate <= endDate, {
		path: ["endDate"],
	});

export const OwnerPaymentExportSchema = PaymentExportRangeSchema;
export const TenantPaymentExportSchema = z.object({
	tenantId: z.uuid(),
});

/**
 * One exportable payment row.
 *
 * This is a read model assembled from payments, leases, units,
 * properties, and the tenant user.
 */
export const PaymentExportRowSchema = z.object({
	id: z.uuid(),
	paymentDate: z.date(),
	type: z.enum(PAYMENT_TYPE_VALUES),
	amount: z.number().int(),
	paymentMethods: z.enum(PAYMENT_METHOD_VALUES).nullable(),
	referenceNumber: z.string().nullable(),
	description: z.string().nullable(),
	tenantName: z.string(),
	propertyName: z.string(),
	unitNumber: z.string(),
});

export const PaymentExportOutputSchema = z.object({
	payments: z.array(PaymentExportRowSchema),
});

// TS Types derieved from Zod (not from InferSelectModel)
export type Payment = z.infer<typeof PaymentSelectSchema>;
export type NewPayment = z.infer<typeof PaymentInsertSchema>;
export type CreatePayment = z.infer<typeof CreatePaymentSchema>;
export type UpdatePayment = z.infer<typeof UpdatePaymentSchema>;
export type RecordUtilityPayment = z.infer<typeof RecordUtilityPaymentSchema>;
export type PaymentListItem = z.infer<typeof PaymentListItemSchema>;
export type PaymentExportRange = z.infer<typeof PaymentExportRangeSchema>;
export type TenantPaymentExportInput = z.infer<
	typeof TenantPaymentExportSchema
>;
export type PaymentExportRow = z.infer<typeof PaymentExportRowSchema>;
export type PaymentExportOutput = z.infer<typeof PaymentExportOutputSchema>;
