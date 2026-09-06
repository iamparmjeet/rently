import { ORPCError } from "@orpc/server";
import { protectedProcedure } from "@rently/api/procedures";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import { leases, properties, units } from "@rently/db/schema/schema";
import { eq } from "drizzle-orm";
import z from "zod";
import { getLeasePeriodBalances } from "../helpers/period-balance";

// C05: the single owner/tenant-safe period balance read model. Returns
// current rent, overdue rent, outstanding utilities, credits, paid amounts,
// and period identity per lease. C06 begins migrating owner screens onto it
// (Upcoming Dues, tenant pending, combined bills); the remaining lifetime
// readers inside other API responses (tenant list overdue snapshot, stats,
// reminders) cut over in C08.
//
// Scoping (E01-class): an owner sees only leases on their own properties; a
// tenant only leases where they are the tenant (an agreement read therefore
// returns the caller's own leases, never another shared tenant's). Admin and
// other roles are refused — the balance model carries no supervisory access.
// The `all` scope returns exactly the leases those same rules make visible,
// in one request, for dashboard surfaces.

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
				all: z.boolean().optional(),
			})
			.refine(
				(value) =>
					[
						value.leaseId !== undefined,
						value.agreementId !== undefined,
						value.all === true,
					].filter((present) => present).length === 1,
				{
					message: "Provide exactly one of leaseId, agreementId, or all",
				},
			),
	)
	.output(
		z.object({
			scope: z.enum(["lease", "agreement", "all"]),
			leases: z.array(leaseBalanceSchema),
		}),
	)
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		const isOwner = authUser.role === USER_ROLES.OWNER;
		const isTenant = authUser.role === USER_ROLES.TENANT;
		if (!isOwner && !isTenant) {
			throw new ORPCError("FORBIDDEN", {
				message: "You do not have access to this balance.",
			});
		}

		const rows = await db
			.select({
				id: leases.id,
				tenantId: leases.tenantId,
				ownerId: properties.ownerId,
			})
			.from(leases)
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.where(
				input.leaseId !== undefined
					? eq(leases.id, input.leaseId)
					: input.agreementId !== undefined
						? eq(leases.agreementId, input.agreementId)
						: undefined,
			);

		const visibleLeaseIds = rows
			.filter((row) =>
				isOwner ? row.ownerId === authUser.id : row.tenantId === authUser.id,
			)
			.map((row) => row.id);

		// A specific lease/agreement that yields nothing is an access error;
		// an empty `all` scope is a legitimate empty portfolio.
		const requestedSpecific =
			input.leaseId !== undefined || input.agreementId !== undefined;
		if (visibleLeaseIds.length === 0 && requestedSpecific) {
			throw new ORPCError("FORBIDDEN", {
				message: "You do not have access to this balance.",
			});
		}

		const balances = await getLeasePeriodBalances(db, visibleLeaseIds);

		return {
			scope:
				input.leaseId !== undefined
					? ("lease" as const)
					: input.agreementId !== undefined
						? ("agreement" as const)
						: ("all" as const),
			leases: balances,
		};
	});
