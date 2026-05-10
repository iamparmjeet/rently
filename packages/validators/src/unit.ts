import { units } from "@rently/db/schema/schema";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type z from "zod";

// ******** Units **********

// Derive Zod Schemas - For Runtime
export const UnitSelectSchema = createSelectSchema(units);
export const UnitInsertSchema = createInsertSchema(units);

// Business Logic Schemas
export const CreateUnitSchema = UnitInsertSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
});

export const UpdateUnitSchema = UnitSelectSchema.partial().pick({
	id: true,
	unitNumber: true,
	type: true,
	area: true,
	baseRent: true,
	description: true,
	status: true,
});

// TS Types derieved from Zod (not from InferSelectModel)
export type Unit = z.infer<typeof UnitSelectSchema>;
export type NewUnit = z.infer<typeof UnitInsertSchema>;
