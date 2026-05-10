import { leases } from "@rently/db/schema/schema";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type z from "zod";

// ******** Lease **********

// Derive Zod Schemas - For Runtime
export const LeaseSelectSchema = createSelectSchema(leases);
export const LeaseInsertSchema = createInsertSchema(leases);

// const endDateAfterStartDate = (
// 	lease: z.infer<typeof LeaseBaseSchema>,
// 	ctx: any,
// ) => {
// 	if (lease.endDate && lease.startDate && lease.endDate <= lease.startDate) {
// 		ctx.addIssue({
// 			code: "custom",
// 			message: "End date must be after start date",
// 			path: ["endDate"],
// 		});
// 	}
// };

// export const LeaseSchema = LeaseBaseSchema.superRefine(endDateAfterStartDate);

// Business Logic Schemas
export const CreateLeaseSchema = LeaseInsertSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
});

export const UpdateLeaseSchema = LeaseSelectSchema.partial().pick({
	unitId: true,
	tenantId: true,
	startDate: true,
	endDate: true,
	rent: true,
	deposit: true,
	status: true,
	referenceId: true,
});

// TS Types derieved from Zod (not from InferSelectModel)
export type Lease = z.infer<typeof LeaseSelectSchema>;
export type NewLease = z.infer<typeof LeaseInsertSchema>;
