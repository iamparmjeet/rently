import { LEASE_STATUS_VALUES } from "@rently/db/constants/rent-constants";
import { units } from "@rently/db/schema/schema";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import z from "zod";

// ******** Units **********

// ── Layer 1: DB-derived
// Derive Zod Schemas - For Runtime
export const UnitSelectSchema = createSelectSchema(units);
export const UnitInsertSchema = createInsertSchema(units);

// ── Layer 2 - API Input
// Business Logic Schemas
export const CreateUnitSchema = UnitInsertSchema.omit({
	id: true,
	status: true,
	createdAt: true,
	updatedAt: true,
});

export const UpdateUnitSchema = createUpdateSchema(units).pick({
	unitNumber: true,
	type: true,
	area: true,
	baseRent: true,
	furnishing: true,
	description: true,
	status: true,
});

// Layer 3 - API output
export const UnitDetailSchema = UnitSelectSchema.extend({
	propertyName: z.string(),
	propertyId: z.string(),
	unitNumber: z.string(),
	baseRent: z.number(),
	area: z.number().nullable(),
	description: z.string().nullable(),
	furnishing: z.string().nullable(),
});

// Lease Summary embedded inside a unit details response
export const ActiveLeaseSchema = z.object({
	id: z.string(),
	tenantId: z.string(),
	tenantName: z.string().nullable(),
	tenantEmail: z.string().nullable(),
	rent: z.number(),
	startDate: z.date(),
	status: z.enum(LEASE_STATUS_VALUES),
});

export const UnitWithLeaseSchema = UnitDetailSchema.extend({
	activeLease: ActiveLeaseSchema.nullable(),
});

// TS Types derieved from Zod (not from InferSelectModel)
export type Unit = z.infer<typeof UnitSelectSchema>;
export type NewUnit = z.infer<typeof UnitInsertSchema>;
export type CreateUnit = z.infer<typeof CreateUnitSchema>;
export type UpdateUnit = z.infer<typeof UpdateUnitSchema>;
export type UnitDetail = z.infer<typeof UnitDetailSchema>;
export type UnitWithLease = z.infer<typeof UnitWithLeaseSchema>;
