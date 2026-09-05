import { utilities } from "@rently/db/schema/schema";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import z from "zod";

// ******** Utility **********
// ── Layer 1: DB-derived
// Derive Zod Schemas - For Runtime
// idempotencyKey is an internal dedupe column — not part of any API response.
export const UtilitySelectSchema = createSelectSchema(utilities).omit({
	idempotencyKey: true,
});
export const UtilityInsertSchema = createInsertSchema(utilities);

// B02: nonnegative charges/rates/readings, current reading not below the
// previous one, ordered period dates. Shared as a plain function so the
// batch handler can apply the same rule per item (BatchItemSchema omits the
// base, which zod forbids on refined schemas — same reason the single-create
// rule lives on CreateUtilityRequestSchema below, not the base).
export type UtilityBoundedInput = {
	fixedCharge?: number | null;
	ratePerUnit?: number | null;
	previousReading?: number | null;
	currentReading?: number | null;
	previousReadingDate?: Date | string | null;
	currentReadingDate?: Date | string | null;
};

export function utilityBoundsViolation(
	value: UtilityBoundedInput,
): string | null {
	if (value.fixedCharge != null && value.fixedCharge < 0) {
		return "Fixed charge must be >= 0";
	}
	if (value.ratePerUnit != null && value.ratePerUnit < 0) {
		return "Rate per unit must be >= 0";
	}
	if (value.previousReading != null && value.previousReading < 0) {
		return "Previous reading must be >= 0";
	}
	if (value.currentReading != null && value.currentReading < 0) {
		return "Current reading must be >= 0";
	}
	if (
		value.previousReading != null &&
		value.currentReading != null &&
		value.currentReading < value.previousReading
	) {
		return "Current reading must be >= previous reading";
	}
	if (
		value.previousReadingDate != null &&
		value.currentReadingDate != null &&
		new Date(value.previousReadingDate) > new Date(value.currentReadingDate)
	) {
		return "Previous reading date must be on or before the current reading date";
	}
	return null;
}

const refineUtilityBounds = (
	value: UtilityBoundedInput,
	ctx: z.RefinementCtx,
) => {
	const violation = utilityBoundsViolation(value);
	if (violation) ctx.addIssue({ code: "custom", message: violation });
};

// ── Layer 2: API-input
// Business Logic Schemas
export const CreateUtilitySchema = UtilityInsertSchema.omit({
	id: true,
	unitsUsed: true,
	totalAmount: true,
	isPaid: true,
	createdAt: true,
	updatedAt: true,
});

// Strict single-create input; the base stays unrefined for BatchItemSchema.
// B07: the dialog-open key is required so retried creates return the
// existing bill instead of duplicating it.
export const CreateUtilityRequestSchema = CreateUtilitySchema.extend({
	idempotencyKey: z.uuid(),
}).superRefine(refineUtilityBounds);

export const UpdateUtilitySchema = createUpdateSchema(utilities)
	.pick({
		utilityType: true,
		previousReadingDate: true,
		currentReadingDate: true,
		previousReading: true,
		currentReading: true,
		ratePerUnit: true,
		fixedCharge: true,
		unitsUsed: true,
		description: true,
	})
	.superRefine(refineUtilityBounds);
export const BillCreditSchema = z.object({
	amount: z.number().int(),
	reason: z.string(),
	creditNoteNo: z.string(),
	type: z.string().optional(),
	appliedAs: z.string().optional(),
});

// 3 -> Enriched list
export const UtilityListItemSchema = UtilitySelectSchema.extend({
	unitNumber: z.string(),
	propertyName: z.string(),
	tenantName: z.string().nullable(),
	tenantPhone: z.string().nullable(),
	tenantEmail: z.string().nullable(),
	// The payment that settled this bill. It is used to open the existing
	// payment receipt from the Utilities screen.
	receiptPaymentId: z.uuid().nullable(),
	receiptPaymentDate: z.date().nullable().optional(),
	hasReversedPayment: z.boolean().optional(),
	amountDue: z.number().int().optional(),
	credits: z.array(BillCreditSchema).optional(),
});

// Enriched document data for a single printable utility bill. Keep this
// separate from the list shape so the bill can include issuer and property
// details without making every Utilities list request heavier.
export const UtilityBillDataSchema = UtilitySelectSchema.extend({
	unitNumber: z.string(),
	propertyName: z.string(),
	propertyAddress: z.string(),
	tenantName: z.string(),
	ownerName: z.string(),
	companyName: z.string().nullable(),
	ownerAddress: z.string().nullable(),
	gstNumber: z.string().nullable(),
	receiptPaymentId: z.uuid().nullable(),
	amountDue: z.number().int().optional(),
	credits: z.array(BillCreditSchema).optional(),
});

export const UtilityReadingSchema = z
	.object({
		previousReading: z.number().min(0, { error: "Must be >= 0" }),
		currentReading: z.number().min(0, { error: "Must be >= 0" }),
		ratePerUnit: z.number().min(0),
		fixedCharge: z.number().min(0),
		isPaid: z.boolean(),
	})
	.refine((v) => v.currentReading >= v.previousReading, {
		error: "Current reading must be >= previous reading",
	});

export const FixedChargeSchema = z.object({
	// totalAmount IS the fixedCharge for maintenance — no unit calculation
	fixedCharge: z.number().min(1, {
		error: "Amount must be at lease ₹1.00",
	}),
	description: z.string().optional(),
	isPaid: z.boolean(),
});

// The top-level batch form schema
export const UtilityBatchFormSchema = z
	.object({
		leaseId: z.string().min(1, { error: "Lease is required" }),
		batchId: z.uuid(),
		previousReadingDate: z
			.string()
			.min(1, { error: "Reading date is required" }),
		currentReadingDate: z
			.string()
			.min(1, { error: "Reading date is required" }),
		// batchId generated client-side — server stamps it on all rows
		electricity: UtilityReadingSchema.optional(),
		water: FixedChargeSchema.optional(),
		maintenance: FixedChargeSchema.optional(),
	})
	.refine(
		(v) =>
			v.electricity !== undefined ||
			v.water !== undefined ||
			v.maintenance !== undefined,
		{
			error: "At least one utility type must be included",
		},
	);

// TS Types derieved from Zod (not from InferSelectModel)
export type Utility = z.infer<typeof UtilitySelectSchema>;
export type NewUtility = z.infer<typeof UtilityInsertSchema>;
export type CreateUtility = z.infer<typeof CreateUtilitySchema>;
export type UpdateUtility = z.infer<typeof UpdateUtilitySchema>;
export type UtilityListItem = z.infer<typeof UtilityListItemSchema>;
export type UtilityBillData = z.infer<typeof UtilityBillDataSchema>;
export type UtilityBatchFormValues = z.infer<typeof UtilityBatchFormSchema>;
export type MeterReading = z.infer<typeof UtilityReadingSchema>;
export type FixedCharge = z.infer<typeof FixedChargeSchema>;
