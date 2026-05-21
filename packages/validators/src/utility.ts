import { utilities } from "@rently/db/schema/schema";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import type z from "zod";

// ******** Utility **********
// ── Layer 1: DB-derived
// Derive Zod Schemas - For Runtime
export const UtilitySelectSchema = createSelectSchema(utilities);
export const UtilityInsertSchema = createInsertSchema(utilities);

// ── Layer 2: API-input
// Business Logic Schemas
export const CreateUtilitySchema = UtilityInsertSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
});

export const UpdateUtilitySchema = createUpdateSchema(utilities).pick({
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
export type CreateUtility = z.infer<typeof CreateUtilitySchema>;
export type UpdateUtility = z.infer<typeof UpdateUtilitySchema>;
