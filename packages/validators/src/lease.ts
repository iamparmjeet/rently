import { LEASE_STATUS_VALUES } from "@rently/db/constants/rent-constants";
import z from "zod";

const LeaseBaseSchema = z.object({
	id: z.uuid(),
	tenantId: z.uuid(),
	unitId: z.string().min(1, "Unit ID must be at least 1"),
	startDate: z.date(),
	endDate: z.date().optional(),
	rent: z.number().positive("Rent must be a positive number"),
	deposit: z.number().optional(),
	status: z.enum(LEASE_STATUS_VALUES),
	referenceId: z.uuid(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

const endDateAfterStartDate = (
	lease: z.infer<typeof LeaseBaseSchema>,
	ctx: any,
) => {
	if (lease.endDate && lease.startDate && lease.endDate <= lease.startDate) {
		ctx.addIssue({
			code: "custom",
			message: "End date must be after start date",
			path: ["endDate"],
		});
	}
};

export const LeaseSchema = LeaseBaseSchema.superRefine(endDateAfterStartDate);

export const CreateLeaseSchema = LeaseBaseSchema.omit({
	id: true,
	createdAt: true,
	updatedAt: true,
});

export const UpdateLeaseSchema = LeaseBaseSchema.partial().pick({
	unitId: true,
	tenantId: true,
	startDate: true,
	endDate: true,
	rent: true,
	deposit: true,
	status: true,
	referenceId: true,
});
