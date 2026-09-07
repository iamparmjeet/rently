// H01: server-issued printable statements. The combined-bill page used to
// take an arbitrary `?ids=` utility list; issue locks the composition (one
// owner, one lease, one month) and the read computes every amount, so the
// page renders only server data.
import z from "zod";
import { UtilityBillDataSchema } from "./utility";

export const IssueBillStatementSchema = z
	.object({
		utilityIds: z.array(z.uuid()).min(1).max(10),
	})
	.refine(
		(value) => new Set(value.utilityIds).size === value.utilityIds.length,
		{
			message: "Duplicate utility bills in the statement request",
		},
	);

export const BillStatementIdSchema = z.object({ id: z.uuid() });

export const BillStatementSchema = z.object({
	id: z.uuid(),
	billNumber: z.string(),
	leaseId: z.uuid(),
	propertyName: z.string(),
	unitNumber: z.string(),
	tenantName: z.string().nullable(),
	periodKey: z.string(),
	expiresAt: z.date(),
	rentDue: z.number(),
	utilityTotalDue: z.number(),
	statementTotal: z.number(),
	utilities: z.array(UtilityBillDataSchema),
});

export type BillStatement = z.infer<typeof BillStatementSchema>;
