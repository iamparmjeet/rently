import { utilities } from "@rently/db/schema/schema";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type z from "zod";

// ******** Utility **********

// Derive Zod Schemas - For Runtime
export const UtilitySelectSchema = createSelectSchema(utilities);
export const UtilityInsertSchema = createInsertSchema(utilities);

// Business Logic Schemas
export const CreateUtilitySchema = UtilityInsertSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
});

export const UpdateUtilitySchema = UtilitySelectSchema.partial().pick({
	id: true,
	leaseId: true,
	utilityType: true,
	readingDate: true,
	ratePerUnit: true,
	unitsUsed: true,
	previousReading: true,
	currentReading: true,
	fixedCharge: true,
	totalAmount: true,
	isPaid: true,
});

// TS Types derieved from Zod (not from InferSelectModel)
export type Utility = z.infer<typeof UtilitySelectSchema>;
export type NewUtility = z.infer<typeof UtilityInsertSchema>;
