import { ORPCError } from "@orpc/server";
import { ownerProcedure, protectedProcedure } from "@rently/api/procedures";
import { StatusCode, StatusPhrase } from "@rently/api/utils";
import type { Database } from "@rently/db";
import {
	FIXEDCHARGE,
	RATEPERUNIT,
} from "@rently/db/constants/payment-constants";
import { UTILITY_TYPES } from "@rently/db/constants/rent-constants";
import { user } from "@rently/db/schema/auth";
import {
	leases,
	payments,
	properties,
	units,
	utilities,
} from "@rently/db/schema/schema";
import {
	CreateUtilitySchema,
	RecordUtilityPaymentSchema,
	UpdateUtilitySchema,
	UtilityListItemSchema,
	UtilitySelectSchema,
} from "@rently/validators";
import { and, eq } from "drizzle-orm";
import z from "zod";
import { isLeaseOwner, VerifyLeaseOwnership } from "../helpers";

// ******** Shared Helper ************
type ComputeTotal = {
	utilityType: string;
	currentReading: number | null | undefined;
	previousReading: number | null | undefined;
	ratePerUnit: number | null | undefined;
	fixedCharge: number | null | undefined;
};
function computeTotal({
	currentReading,
	fixedCharge,
	previousReading,
	ratePerUnit,
	utilityType,
}: ComputeTotal): number {
	if (utilityType === UTILITY_TYPES.MAINTENANCE) {
		return fixedCharge ?? 0;
	}
	const units = (currentReading ?? 0) - (previousReading ?? 0);
	return Math.round(
		units * (ratePerUnit ?? RATEPERUNIT) + (fixedCharge ?? FIXEDCHARGE),
	);
}

async function getOwnedUtility(
	db: Database,
	utilityId: string,
	userId: string,
) {
	const [row] = await db
		.select({
			id: utilities.id,
			leaseId: utilities.leaseId,
			batchId: utilities.batchId,
			utilityType: utilities.utilityType,
			currentReadingDate: utilities.currentReadingDate,
			previousReadingDate: utilities.previousReadingDate,
			ratePerUnit: utilities.ratePerUnit,
			unitsUsed: utilities.unitsUsed,
			previousReading: utilities.previousReading,
			currentReading: utilities.currentReading,
			fixedCharge: utilities.fixedCharge,
			totalAmount: utilities.totalAmount,
			description: utilities.description,
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
export const createUtility = ownerProcedure
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
		const ownLease = await isLeaseOwner(db, authUser.id, input.leaseId);
		if (!ownLease) {
			throw new ORPCError(StatusPhrase.FORBIDDEN, {
				message: "you don't own this lease",
			});
		}
		const isMeter = input.utilityType !== UTILITY_TYPES.MAINTENANCE;

		// Business rule: total = (current - previous) * ratePerUnit
		// Always computed server side - never client side
		const unitsUsed = isMeter
			? input.currentReading - input.previousReading
			: null;

		const totalAmount = computeTotal({
			utilityType: input.utilityType,
			currentReading: input.currentReading,
			previousReading: input.currentReading,
			ratePerUnit: input.ratePerUnit,
			fixedCharge: input.fixedCharge,
		});

		const [utility] = await db
			.insert(utilities)
			.values({
				leaseId: input.leaseId,
				utilityType: input.utilityType,
				previousReadingDate: input.previousReadingDate,
				currentReadingDate: input.currentReadingDate,
				previousReading: input.previousReading,
				currentReading: input.currentReading,
				unitsUsed,
				ratePerUnit: input.ratePerUnit ?? RATEPERUNIT,
				fixedCharge: input.fixedCharge ?? FIXEDCHARGE,
				totalAmount,
				description: input.description ?? null,
				isPaid: false,
			})
			.returning();

		if (!utility) {
			throw new ORPCError(StatusPhrase.INTERNAL_SERVER_ERROR, {
				message: "Failed to create utility entry",
			});
		}

		return { utility };
	});

// 2. Update
export const updateUtility = ownerProcedure
	.route({ method: "PATCH", path: "/rent/utility/update" })
	.input(z.object({ id: z.string(), data: UpdateUtilitySchema }))
	.output(z.object({ utility: UtilitySelectSchema }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		// getOwnedUtility
		const existing = await getOwnedUtility(db, input.id, authUser.id);

		// Recalculate totalAmount — always recompute from final merged values
		const finalType = input.data.utilityType ?? existing.utilityType;
		const finalCurrent = Number(
			input.data.currentReading ?? existing.currentReading,
		);
		const finalPrevious = Number(
			input.data.previousReading ?? existing.previousReading,
		);
		const finalRate =
			input.data.ratePerUnit ?? existing.ratePerUnit ?? RATEPERUNIT;
		const finalFixed =
			input.data.fixedCharge ?? existing.fixedCharge ?? FIXEDCHARGE;

		const isMeter = finalType !== UTILITY_TYPES.MAINTENANCE;

		const unitsUsed = isMeter
			? (finalCurrent ?? 0) - (finalPrevious ?? 0)
			: null;

		const totalAmount = computeTotal({
			utilityType: finalType,
			currentReading: finalCurrent,
			previousReading: finalPrevious,
			ratePerUnit: finalRate,
			fixedCharge: finalFixed,
		});

		const [updated] = await db
			.update(utilities)
			.set({
				...input.data,
				unitsUsed,
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

// 3.getById
export const getUtilityById = ownerProcedure
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

// 4. list
export const listUtilities = ownerProcedure
	.route({
		method: "GET",
		path: "/rent/utility/list",
	})
	.input(
		z.object({
			leaseId: z.string().optional(),
		}),
	)
	.output(z.object({ utilities: z.array(UtilityListItemSchema) }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		// This is one query vs N+1 separate lookups per throw
		const whereClause = input.leaseId
			? and(
					eq(properties.ownerId, authUser.id),
					eq(utilities.leaseId, input.leaseId),
				)
			: eq(properties.ownerId, authUser.id);

		const results = await db
			.select({
				id: utilities.id,
				leaseId: utilities.leaseId,
				batchId: utilities.batchId,
				utilityType: utilities.utilityType,
				previousReadingDate: utilities.previousReadingDate,
				currentReadingDate: utilities.currentReadingDate,
				ratePerUnit: utilities.ratePerUnit,
				unitsUsed: utilities.unitsUsed,
				previousReading: utilities.previousReading,
				currentReading: utilities.currentReading,
				fixedCharge: utilities.fixedCharge,
				totalAmount: utilities.totalAmount,
				description: utilities.description,
				isPaid: utilities.isPaid,
				createdAt: utilities.createdAt,
				updatedAt: utilities.updatedAt,
				// enriched context
				unitNumber: units.unitNumber,
				propertyName: properties.name,
				tenantName: user.name,
				tenantPhone: user.phone,
				tenantEmail: user.email,
			})
			.from(utilities)
			.innerJoin(leases, eq(utilities.leaseId, leases.id))
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.innerJoin(user, eq(leases.tenantId, user.id))
			.where(whereClause)
			.orderBy(utilities.currentReadingDate);

		return {
			utilities: results,
		};
	});

// 5. Remove
export const removeUtility = ownerProcedure
	.route({ method: "DELETE", path: "/rent/utility/remove" })
	.input(z.object({ id: z.string() }))
	.output(z.object({ success: z.boolean() }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		await getOwnedUtility(db, input.id, authUser.id);
		await db.delete(utilities).where(eq(utilities.id, input.id));

		return { success: true };
	});

const BatchItemSchema = CreateUtilitySchema.extend({
	batchId: z.uuid(),
});

// 6. Batch
export const createUtilityBatch = ownerProcedure
	.route({
		method: "POST",
		path: "/rent/utility/create-batch",
		successStatus: StatusCode.CREATED,
	})
	.input(
		z.object({
			leaseId: z.uuid(),
			batchId: z.uuid(),
			items: z.array(BatchItemSchema).min(1).max(10),
		}),
	)
	.output(
		z.object({ utilities: z.array(UtilitySelectSchema), batchId: z.uuid() }),
	)
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		await VerifyLeaseOwnership(db, authUser.id, input.leaseId);

		const insertValues = input.items.map((item) => {
			const unitsUsed = Math.max(0, item.currentReading - item.previousReading);
			const totalAmount = Math.round(
				unitsUsed * (item.ratePerUnit ?? RATEPERUNIT) +
					(item.fixedCharge ?? FIXEDCHARGE),
			);

			return {
				leaseId: input.leaseId,
				batchId: input.batchId,
				utilityType: item.utilityType,
				previousReadingDate: item.previousReadingDate,
				currentReadingDate: item.currentReadingDate,
				ratePerUnit: item.ratePerUnit ?? RATEPERUNIT,
				unitsUsed,
				previousReading: item.previousReading,
				currentReading: item.currentReading,
				fixedCharge: item.fixedCharge ?? FIXEDCHARGE,
				totalAmount,
				description: item.description,
				isPaid: false,
			};
		});

		const inserted = await db.transaction(async (tx) =>
			tx.insert(utilities).values(insertValues).returning(),
		);

		return {
			utilities: inserted,
			batchId: input.batchId,
		};
	});

export const recordUtilityPayment = protectedProcedure
	.route({
		method: "POST",
		path: "/rent/utility/payment",
		successStatus: StatusCode.CREATED,
	})
	.input(RecordUtilityPaymentSchema)
	.output(z.object({ success: z.boolean() }))
	.handler(async ({ input, context }) => {
		const { db, user } = context;

		await VerifyLeaseOwnership(db, user.id, input.leaseId);

		const [utility] = await db
			.select()
			.from(utilities)
			.where(eq(utilities.id, input.utilityId))
			.limit(1);

		if (!utility) {
			throw new ORPCError("NOT_FOUND", { message: "Utility not found" });
		}
		if (utility.leaseId !== input.leaseId) {
			throw new ORPCError("FORBIDDEN", {
				message: "Utility does not belong to this lease",
			});
		}

		// transaction
		await db.transaction(async (tx) => {
			await tx.insert(payments).values({
				leaseId: input.leaseId,
				utilityId: input.utilityId,
				amount: input.amount,
				paymentDate: new Date(input.receivedAt),
				paymentMethods: input.paymentMethod,
				type: "utility",
				description: input.notes ?? null,
				referenceNumber: null,
			});

			await tx
				.update(utilities)
				.set({ isPaid: true, updatedAt: new Date() })
				.where(eq(utilities.id, input.utilityId));
		});

		return { success: true };
	});
