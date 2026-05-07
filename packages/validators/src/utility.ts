import { UTILITY_TYPE_VALUES } from "@rently/db/constants/rent-constants";
import z from "zod";

export const UtilitySchema = z.object({
	id: z.uuid(),
	leaseId: z.uuid(),
	utilityType: z.enum(UTILITY_TYPE_VALUES),
	readingDate: z.date(),
	ratePerUnit: z.number().min(1, "Rate per unit must be at least 1").default(9),
	unitsUsed: z.number().min(0, "Units used must be at least 0").default(0),
	previousReading: z
		.number()
		.min(0, "Previous reading must be at least 0")
		.default(0),
	currentReading: z.number().default(0),
	fixedCharge: z.number().optional().default(0),
	totalAmount: z.number().optional(),
	isPaid: z.boolean().default(false),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const CreateUtilitySchema = UtilitySchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
});

export const UpdateUtilitySchema = UtilitySchema.partial().pick({
	id: true,
	leaseId: true,
	utilityType: true,
	readingDate: true,
	ratePerUnit: true,
	unitsUsed: true,
	previousReading: true,
	currentReading: true,
	fixedCharge: true,
	totalAmount: true,
	isPaid: true,
});
