import z from "zod";

export const OverdueLeaseSchema = z.object({
	leaseId: z.string(),
	tenantId: z.string(),
	tenantName: z.string(),
	propertyName: z.string(),
	unitNumber: z.string(),
	rent: z.number().int(),
	paidAmount: z.number().int(),
	outstandingAmount: z.number().int(),
	dueDate: z.string(),
	daysOverdue: z.number().int().positive(),
});

export const OverdueSummarySchema = OverdueLeaseSchema.pick({
	paidAmount: true,
	outstandingAmount: true,
	dueDate: true,
	daysOverdue: true,
});

export const OverdueLeasesResponseSchema = z.object({
	leases: z.array(OverdueLeaseSchema),
});

export type OverdueLease = z.infer<typeof OverdueLeaseSchema>;
