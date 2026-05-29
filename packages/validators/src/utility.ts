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
export const UtilitySelectSchema = createSelectSchema(utilities);
export const UtilityInsertSchema = createInsertSchema(utilities);

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

export const UpdateUtilitySchema = createUpdateSchema(utilities).pick({
	leaseId: true,
	utilityType: true,
	previousReadingDate: true,
	currentReadingDate: true,
	previousReading: true,
	currentReading: true,
	ratePerUnit: true,
	fixedCharge: true,
	unitsUsed: true,
	description: true,
});
// 3 -> Enriched list
export const UtilityListItemSchema = UtilitySelectSchema.extend({
	unitNumber: z.string(),
	propertyName: z.string(),
	tenantName: z.string().nullable(),
	tenantPhone: z.string().nullable(),
	tenantEmail: z.string().nullable(),
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
	fixedCharge: z.number().min(1, { error: "Amount must be > 0" }),
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
export type UtilityBatchFormValues = z.infer<typeof UtilityBatchFormSchema>;
export type MeterReading = z.infer<typeof UtilityReadingSchema>;
export type FixedCharge = z.infer<typeof FixedChargeSchema>;
