import { LEASE_STATUS_VALUES } from "@rently/db/constants/rent-constants";
import { leases } from "@rently/db/schema/schema";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import z from "zod";

// ── Shared refinement (DRY) ──────────────────────────────────
const dateOrderRefine = (data: {
	startDate?: Date | string;
	endDate?: Date | null | string;
}) => {
	if (data.endDate && data.startDate) {
		return new Date(data.endDate) > new Date(data.startDate);
	}
	return true;
};
const dateOrderError = {
	message: "End date must be after start date",
	path: ["endDate"],
};

// ******** Lease **********
// ── Layer 1: DB-derived
// Derive Zod Schemas - For Runtime
export const LeaseSelectSchema = createSelectSchema(leases);
export const LeaseInsertSchema = createInsertSchema(leases);

// ── Layer 2: API input schemas
// Business Logic Schemas
export const CreateLeaseSchema = LeaseInsertSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
	status: true,
}).refine(dateOrderRefine, dateOrderError);

export const UpdateLeaseSchema = createUpdateSchema(leases)
	.pick({
		startDate: true,
		endDate: true,
		rent: true,
		deposit: true,
		status: true,
		referenceId: true,
	})
	.refine(dateOrderRefine, dateOrderError);

// ── Layer 3: API output schemas
export const LeaseWithDetailsSchema = z.object({
	leaseId: z.string(),
	unitId: z.string(),
	tenantId: z.string(),
	rent: z.number(),
	deposit: z.number().nullable(),
	startDate: z.date(),
	endDate: z.date().nullable(),
	status: z.enum(LEASE_STATUS_VALUES),
	rentDueDate: z.number().int().nullable(),
	tenantName: z.string().nullable(),
	tenantEmail: z.string().nullable(),
	tenantPhone: z.string().nullable(),
	unitNumber: z.string(),
	propertyName: z.string(),
	propertyId: z.string(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

// TS Types derieved from Zod (not from InferSelectModel)
export type Lease = z.infer<typeof LeaseSelectSchema>;
export type CreateLease = z.infer<typeof CreateLeaseSchema>;
export type UpdateLease = z.infer<typeof UpdateLeaseSchema>;
export type LeaseWithDetails = z.infer<typeof LeaseWithDetailsSchema>;
