import { units } from "@rently/db/schema/schema";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import z from "zod";

// ******** Units **********

// Derive Zod Schemas - For Runtime
export const UnitSelectSchema = createSelectSchema(units);
export const UnitInsertSchema = createInsertSchema(units);

// Business Logic Schemas
export const CreateUnitSchema = UnitInsertSchema.omit({
	id: true,
	status: true,
	createdAt: true,
	updatedAt: true,
});

export const UpdateUnitSchema = UnitSelectSchema.partial().pick({
	unitNumber: true,
	type: true,
	area: true,
	baseRent: true,
	description: true,
	status: true,
});

export const UnitWithPropertyNameSchema = UnitSelectSchema.extend({
	propertyName: z.string(),
});

// TS Types derieved from Zod (not from InferSelectModel)
export type Unit = z.infer<typeof UnitSelectSchema>;
export type NewUnit = z.infer<typeof UnitInsertSchema>;
export type UnitWithPropertyName = z.infer<typeof UnitWithPropertyNameSchema>;
