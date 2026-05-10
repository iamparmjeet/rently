import { properties } from "@rently/db/schema/schema";

import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type z from "zod";

// ******** Property **********
// Derive Zod Schemas - For Runtime
export const PropertySelectSchema = createSelectSchema(properties);
export const PropertyInsertSchema = createInsertSchema(properties);

// Business Logic Schemas
export const CreatePropertySchema = PropertyInsertSchema.omit({
	id: true,
	ownerId: true,
	createdAt: true,
	updatedAt: true,
});

export const UpdatePropertySchema = PropertySelectSchema.partial().pick({
	name: true,
	address: true,
	type: true,
});

// TS Types derieved from Zod (not from InferSelectModel)
export type Property = z.infer<typeof PropertySelectSchema>;
export type NewProperty = z.infer<typeof PropertyInsertSchema>;
