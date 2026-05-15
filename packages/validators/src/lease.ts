import { LEASE_STATUS_VALUES } from "@rently/db/constants/rent-constants";
import { leases } from "@rently/db/schema/schema";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import z from "zod";

// ******** Lease **********

// Derive Zod Schemas - For Runtime
export const LeaseSelectSchema = createSelectSchema(leases);
export const LeaseInsertSchema = createInsertSchema(leases);

// Business Logic Schemas
export const CreateLeaseSchema = LeaseInsertSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
}).refine(
	(data) => {
		if (data.endDate && new Date(data.endDate) <= new Date(data.startDate)) {
			return false;
		}
		return true;
	},
	{
		error: "End Date must be after start date",
		path: ["endDate"],
	},
);

export const UpdateLeaseSchema = LeaseSelectSchema.partial()
	.pick({
		startDate: true,
		endDate: true,
		rent: true,
		deposit: true,
		status: true,
		referenceId: true,
	})
	.refine(
		(data) => {
			if (data.endDate && data.startDate) {
				return new Date(data.endDate) > new Date(data.startDate);
			}
			return true;
		},
		{
			error: "End date must be after start date",
			path: ["endDate"],
		},
	);

export const LeaseWithDetailsSchema = z.object({
	leaseId: z.string(),
	rent: z.string(),
	deposit: z.string().nullable(),
	startDate: z.date(),
	endDate: z.date().nullable(),
	status: z.enum(LEASE_STATUS_VALUES),
	tenantName: z.string().nullable(),
	tenantEmail: z.string().nullable(),
	tenantPhone: z.string().nullable(),
	unitNumber: z.string(),
	propertyName: z.string(),
	propertyId: z.string(),
});

// TS Types derieved from Zod (not from InferSelectModel)
export type Lease = z.infer<typeof LeaseSelectSchema>;
export type LeaseWithDetails = z.infer<typeof LeaseWithDetailsSchema>;
