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

// B02: positive rent, nonnegative deposit, due day 1-31. Fields are optional
// on update schemas, so each rule fires only when its field is present.
const leaseMoneyRefine = (data: {
	rent?: number | null;
	deposit?: number | null;
	rentDueDate?: number | null;
}) => {
	if (data.rent !== undefined && data.rent !== null && data.rent <= 0) {
		return false;
	}
	if (data.deposit !== undefined && data.deposit !== null && data.deposit < 0) {
		return false;
	}
	if (
		data.rentDueDate !== undefined &&
		data.rentDueDate !== null &&
		!Number.isInteger(data.rentDueDate)
	) {
		return false;
	}
	if (
		data.rentDueDate !== undefined &&
		data.rentDueDate !== null &&
		(data.rentDueDate < 1 || data.rentDueDate > 31)
	) {
		return false;
	}
	return true;
};
const leaseMoneyError = {
	message: "Rent must be > 0, deposit >= 0, and due day must be 1-31",
	path: ["rent"],
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
	agreementId: true,
})
	.refine(dateOrderRefine, dateOrderError)
	.refine(leaseMoneyRefine, leaseMoneyError);

export const CreateCombinedLeaseSchema = LeaseInsertSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
	status: true,
	agreementId: true,
	unitId: true,
	rent: true,
	deposit: true,
})
	.extend({
		units: z
			.array(
				z.object({
					unitId: z.uuid(),
					rent: z.number().int().positive(),
					deposit: z.number().int().nonnegative().nullable().optional(),
				}),
			)
			.min(2, { error: "Select at least two units" })
			.refine(
				(units) =>
					new Set(units.map((unit) => unit.unitId)).size === units.length,
				{ error: "Each unit may appear only once" },
			),
	})
	.refine(dateOrderRefine, dateOrderError)
	.refine(leaseMoneyRefine, leaseMoneyError);

export const UpdateLeaseSchema = createUpdateSchema(leases)
	.pick({
		startDate: true,
		endDate: true,
		rent: true,
		deposit: true,
		status: true,
		referenceId: true,
	})
	.refine(dateOrderRefine, dateOrderError)
	.refine(leaseMoneyRefine, leaseMoneyError);

// ── Layer 3: API output schemas
export const LeaseWithDetailsSchema = z.object({
	leaseId: z.string(),
	agreementId: z.uuid().nullable(),
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
export type CreateCombinedLease = z.infer<typeof CreateCombinedLeaseSchema>;
export type UpdateLease = z.infer<typeof UpdateLeaseSchema>;
export type LeaseWithDetails = z.infer<typeof LeaseWithDetailsSchema>;
