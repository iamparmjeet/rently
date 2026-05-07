// ******** Property **********

import { PropertyInsertSchema } from "@rently/db/types";

export const PropertySchema = PropertyInsertSchema;

export const CreatePropertySchema = PropertySchema.omit({
	id: true,
	ownerId: true,
	createdAt: true,
	updatedAt: true,
});

export const UpdatePropertySchema = PropertySchema.partial().pick({
	name: true,
	address: true,
	type: true,
});
