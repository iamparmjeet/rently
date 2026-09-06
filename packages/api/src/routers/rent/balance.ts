import { ORPCError } from "@orpc/server";
import { protectedProcedure } from "@rently/api/procedures";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import { leases, properties, units } from "@rently/db/schema/schema";
import { eq } from "drizzle-orm";
import z from "zod";
import { getLeasePeriodBalances } from "../helpers/period-balance";

// C05: the single owner/tenant-safe period balance read model. Returns
// current rent, overdue rent, outstanding utilities, credits, paid amounts,
// and period identity per lease. This is additive — no existing reader or
// screen is cut over here (C06/C07 own screen migration; C08 owns cutover).
//
// Scoping (E01-class): an owner sees only leases on their own properties; a
// tenant only leases where they are the tenant (an agreement read therefore
// returns the caller's own leases, never another shared tenant's). Admin and
// other roles are refused — the balance model carries no supervisory access.

const periodChargeSchema = z.object({
	periodKey: z.string(),
	dueDate: z.string(),
	amount: z.number().int(),
	allocated: z.number().int(),
	outstanding: z.number().int(),
	isPaid: z.boolean(),
	isOverdue: z.boolean(),
	isFuture: z.boolean(),
});

const utilityBalanceSchema = z.object({
	id: z.uuid(),
	utilityType: z.string(),
	totalAmount: z.number().int(),
	due: z.number().int(),
	isPaid: z.boolean(),
});

const leaseBalanceSchema = z.object({
	leaseId: z.uuid(),
	agreementId: z.uuid().nullable(),
	status: z.string(),
	rent: z.number().int(),
	rentDueDate: z.number().int().nullable(),
	startDate: z.date(),
	endDate: z.date().nullable(),
	currentPeriodKey: z.string(),
	currentPeriodDueDate: z.string().nullable(),
	charges: z.array(periodChargeSchema),
	currentRentDue: z.number().int(),
	overdueRent: z.number().int(),
	totalRentDue: z.number().int(),
	lifetimeRentDue: z.number().int(),
	accruedGap: z.number().int(),
	credits: z.object({
		total: z.number().int(),
		allocatedToCharges: z.number().int(),
	}),
	paid: z.object({
		lifetime: z.number().int(),
		period: z.number().int(),
	}),
	utilities: z.object({
		totalDue: z.number().int(),
		items: z.array(utilityBalanceSchema),
	}),
});

export const getPeriodBalance = protectedProcedure
	.route({ method: "GET", path: "/rent/balance/period" })
	.input(
		z
			.object({
				leaseId: z.uuid().optional(),
				agreementId: z.uuid().optional(),
			})
			.refine(
				(value) =>
					(value.leaseId !== undefined) !== (value.agreementId !== undefined),
				{
					message: "Provide exactly one of leaseId or agreementId",
				},
			),
	)
	.output(
		z.object({
			scope: z.enum(["lease", "agreement"]),
			leases: z.array(leaseBalanceSchema),
		}),
	)
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		const scopeCondition =
			input.leaseId !== undefined
				? eq(leases.id, input.leaseId)
				: eq(leases.agreementId, input.agreementId as string);

		const rows = await db
			.select({
				id: leases.id,
				tenantId: leases.tenantId,
				ownerId: properties.ownerId,
			})
			.from(leases)
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.where(scopeCondition);

		const visibleLeaseIds = rows
			.filter((row) => {
				if (authUser.role === USER_ROLES.OWNER) {
					return row.ownerId === authUser.id;
				}
				if (authUser.role === USER_ROLES.TENANT) {
					return row.tenantId === authUser.id;
				}
				return false;
			})
			.map((row) => row.id);

		if (visibleLeaseIds.length === 0) {
			throw new ORPCError("FORBIDDEN", {
				message: "You do not have access to this balance.",
			});
		}

		const balances = await getLeasePeriodBalances(db, visibleLeaseIds);

		return {
			scope:
				input.leaseId !== undefined
					? ("lease" as const)
					: ("agreement" as const),
			leases: balances,
		};
	});
