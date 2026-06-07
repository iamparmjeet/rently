import { properties } from "@rently/db/schema/schema";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import z from "zod";

// ******** Property **********
// Layer 1 ) DB Derived
// Derive Zod Schemas - For Runtime
export const PropertySelectSchema = createSelectSchema(properties);
export const PropertyInsertSchema = createInsertSchema(properties);

//  Layer 2 ) - API Input schemas
// Business Logic Schemas
export const CreatePropertySchema = PropertyInsertSchema.omit({
	id: true,
	ownerId: true,
	createdAt: true,
	updatedAt: true,
});

export const UpdatePropertySchema = createUpdateSchema(properties).pick({
	name: true,
	address: true,
	type: true,
	description: true,
	floors: true,
	totalArea: true,
	yearBuilt: true,
});

// Layer 3 : API Output Schemas
// What the API Returns
export const PropertyPublicSchema = PropertySelectSchema;
export const PropertyListItemSchema = PropertySelectSchema.pick({
	id: true,
	name: true,
	address: true,
	type: true,
	createdAt: true,
});

export const PropertyWithStatsSchema = PropertySelectSchema.extend({
	totalUnits: z.number().int(),
	occupiedUnits: z.number().int(),
	availableUnits: z.number().int(),
	monthlyRevenue: z.number().int(),
});

// TS Types derieved from Zod (not from InferSelectModel)
export type Property = z.infer<typeof PropertySelectSchema>;
export type NewProperty = z.infer<typeof PropertyInsertSchema>;
export type CreateProperty = z.infer<typeof CreatePropertySchema>;
export type UpdateProperty = z.infer<typeof UpdatePropertySchema>;
export type PropertyListItem = z.infer<typeof PropertyListItemSchema>;
export type PropertyWithStats = z.infer<typeof PropertyWithStatsSchema>;
