import { ORPCError } from "@orpc/server";
import { protectedProcedure } from "@rently/api/procedures";
import { StatusCode, StatusPhrase } from "@rently/api/utils";
import type { Database } from "@rently/db";
import {
	FIXEDCHARGE,
	RATEPERUNIT,
} from "@rently/db/constants/payment-constants";
import { leases, properties, units, utilities } from "@rently/db/schema/schema";
import {
	CreateUtilitySchema,
	UpdateUtilitySchema,
	UtilitySelectSchema,
} from "@rently/validators";
import { eq } from "drizzle-orm";
import z from "zod";
import { isLeaseOwner, VerifyLeaseOwnership } from "../helpers";

// ******************** Share Helper ************
async function getOwnedUtility(
	db: Database,
	utilityId: string,
	userId: string,
) {
	const [row] = await db
		.select({
			id: utilities.id,
			leaseId: utilities.leaseId,
			utilityType: utilities.utilityType,
			readingDate: utilities.readingDate,
			ratePerUnit: utilities.ratePerUnit,
			unitsUsed: utilities.unitsUsed,
			previousReading: utilities.previousReading,
			currentReading: utilities.currentReading,
			fixedCharge: utilities.fixedCharge,
			totalAmount: utilities.totalAmount,
			isPaid: utilities.isPaid,
			createdAt: utilities.createdAt,
			updatedAt: utilities.updatedAt,
			ownerId: properties.ownerId,
		})
		.from(utilities)
		.innerJoin(leases, eq(utilities.leaseId, leases.id))
		.innerJoin(units, eq(leases.unitId, units.id))
		.innerJoin(properties, eq(units.propertyId, properties.id))
		.where(eq(utilities.id, utilityId))
		.limit(1);

	if (!row) {
		throw new ORPCError(StatusPhrase.NOT_FOUND, {
			message: "Utility entry not found",
		});
	}

	if (row.ownerId !== userId) {
		throw new ORPCError(StatusPhrase.FORBIDDEN, {
			message: "You do not own this utility",
		});
	}

	return row;
}

// **********************************************

//create
export const createUtility = protectedProcedure
	.route({
		method: "POST",
		path: "/rent/utility/create",
		successStatus: StatusCode.CREATED,
	})
	.input(CreateUtilitySchema)
	.output(z.object({ utility: UtilitySelectSchema }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		// Verify Lease ownership
		const ownLease = isLeaseOwner(db, authUser.id, input.leaseId);

		if (!ownLease) {
			throw new ORPCError(StatusPhrase.FORBIDDEN, {
				message: "you don't own this lease",
			});
		}

		// Business rule: total = (current - previous) * ratePerUnit
		const totalAmount =
			(input.currentReading - input.previousReading) *
				(input.ratePerUnit ?? RATEPERUNIT) +
			(input.fixedCharge ?? FIXEDCHARGE);

		const [utility] = await db
			.insert(utilities)
			.values({
				leaseId: input.leaseId,
				utilityType: input.utilityType,
				readingDate: input.readingDate,
				ratePerUnit: input.ratePerUnit ?? RATEPERUNIT,
				unitsUsed:
					input.unitsUsed ?? input.currentReading - input.previousReading,
				previousReading: input.previousReading,
				currentReading: input.currentReading,
				fixedCharge: input.fixedCharge ?? FIXEDCHARGE,
				totalAmount,
				isPaid: input.isPaid ?? false,
			})
			.returning();

		if (!utility) {
			throw new ORPCError(StatusPhrase.INTERNAL_SERVER_ERROR, {
				message: "Failed to create utility entry",
			});
		}

		return { utility };
	});

// update
export const updateUtility = protectedProcedure
	.route({ method: "PATCH", path: "/rent/utility/update" })
	.input(z.object({ id: z.string(), data: UpdateUtilitySchema }))
	.output(z.object({ utility: UtilitySelectSchema }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		// getOwnedUtility
		const existing = await getOwnedUtility(db, input.id, authUser.id);

		// Recalculate totalAmount — always recompute from final merged values
		const totalAmount =
			(Number(input.data.currentReading ?? existing.currentReading) -
				Number(input.data.previousReading ?? existing.previousReading)) *
				(input.data.ratePerUnit ?? existing.ratePerUnit ?? RATEPERUNIT) +
			(input.data.fixedCharge ?? existing.fixedCharge ?? FIXEDCHARGE);

		const { id: _id, ...safeData } = input.data as typeof input.data & {
			id?: string;
		};

		const [updated] = await db
			.update(utilities)
			.set({
				...safeData,
				totalAmount,
				updatedAt: new Date(),
			})
			.where(eq(utilities.id, input.id))
			.returning();

		if (!updated) {
			throw new ORPCError(StatusPhrase.NOT_FOUND, {
				message: "Utility not found after update",
			});
		}

		return { utility: updated };
	});

// getById
export const getUtilityById = protectedProcedure
	.route({ method: "GET", path: "/rent/utility/get" })
	.input(z.object({ id: z.string() }))
	.output(z.object({ utility: UtilitySelectSchema }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		// getOwnedUtility does the find + ownership check
		const row = await getOwnedUtility(db, input.id, authUser.id);

		// Strip the joined ownerId before returning
		const { ownerId: _ownerId, ...utility } = row;
		return { utility };
	});

// getAll
export const listUtility = protectedProcedure
	.route({
		method: "GET",
		path: "/rent/utility/get",
	})
	.output(z.object({ utilities: z.array(UtilitySelectSchema) }))
	.handler(async ({ context }) => {
		const { db, user: authUser } = context;

		const results = await db
			.select({
				id: utilities.id,
				leaseId: utilities.leaseId,
				utilityType: utilities.utilityType,
				readingDate: utilities.readingDate,
				ratePerUnit: utilities.ratePerUnit,
				unitsUsed: utilities.unitsUsed,
				previousReading: utilities.previousReading,
				currentReading: utilities.currentReading,
				fixedCharge: utilities.fixedCharge,
				totalAmount: utilities.totalAmount,
				isPaid: utilities.isPaid,
				createdAt: utilities.createdAt,
				updatedAt: utilities.updatedAt,
			})
			.from(utilities)
			.innerJoin(leases, eq(utilities.leaseId, leases.id))
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.where(eq(properties.ownerId, authUser.id));

		return {
			utilities: results,
		};
	});

// remove
export const remove = protectedProcedure
	.route({ method: "DELETE", path: "/rent/utility/remove" })
	.input(z.object({ id: z.string() }))
	.output(z.object({ success: z.boolean() }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		await getOwnedUtility(db, input.id, authUser.id);
		await db.delete(utilities).where(eq(utilities.id, input.id));

		return { success: true };
	});
