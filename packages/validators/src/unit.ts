import {
	UNIT_STATUS_VALUES,
	UNIT_TYPES_VALUES,
} from "@rently/db/constants/rent-constants";
import z from "zod";

export const UnitSchema = z.object({
	id: z.uuid(),
	propertyId: z.uuid(),
	unitNumber: z.string().min(1, "Unit number must be at least 1"),
	type: z.enum(UNIT_TYPES_VALUES),
	area: z.number().min(1, "Area must be at least 1"),
	baseRent: z.number().min(500, "Base Rent must be at least 500"),
	description: z.string().nullable(),
	status: z.enum(UNIT_STATUS_VALUES),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const CreateUnitSchmea = UnitSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
});

export const UpdateUnitSchema = UnitSchema.partial().pick({
	id: true,
	propertyId: true,
	unitNumber: true,
	type: true,
	area: true,
	baseRent: true,
	description: true,
	status: true,
});
