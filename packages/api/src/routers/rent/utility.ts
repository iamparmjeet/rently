import { ORPCError } from "@orpc/server";
import { ownerProcedure } from "@rently/api/procedures";
import { StatusCode } from "@rently/api/utils";
import type { Database } from "@rently/db";
import {
	FIXEDCHARGE,
	RATEPERUNIT,
} from "@rently/db/constants/payment-constants";
import { UTILITY_TYPES } from "@rently/db/constants/rent-constants";
import { user } from "@rently/db/schema/auth";
import {
	billCredits,
	leases,
	ownerProfiles,
	payments,
	properties,
	units,
	utilities,
} from "@rently/db/schema/schema";
import {
	CreateUtilitySchema,
	RecordUtilityPaymentSchema,
	UpdateUtilitySchema,
	UtilityBillDataSchema,
	UtilityListItemSchema,
	UtilitySelectSchema,
} from "@rently/validators";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import z from "zod";
import { isLeaseOwner, VerifyLeaseOwnership } from "../helpers";
import {
	sendAutomaticPaymentReceipt,
	sendAutomaticUtilityBillEmail,
} from "../helpers/automatic-emails";
import { getAmountDueForUtility } from "../helpers/credit.helpers";

type BatchCapableDatabase = Database & {
	batch<T extends readonly unknown[]>(
		queries: T,
	): Promise<{ [K in keyof T]: Awaited<T[K]> }>;
};

function supportsBatch(db: Database): db is BatchCapableDatabase {
	return typeof (db as { batch?: unknown }).batch === "function";
}

// ******** Shared Helper ************
type ComputeTotalInput = {
	utilityType: string;
	currentReading: number | null | undefined;
	previousReading: number | null | undefined;
	ratePerUnit: number | null | undefined;
	fixedCharge: number | null | undefined;
};
function computeTotalPaisa({
	currentReading,
	fixedCharge,
	previousReading,
	ratePerUnit,
	utilityType,
}: ComputeTotalInput): number {
	if (utilityType === UTILITY_TYPES.MAINTENANCE) {
		return fixedCharge ?? 0;
	}
	const units = (currentReading ?? 0) - (previousReading ?? 0);
	if (units < 0) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Current reading cannot be less than previous reading",
		});
	}

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
			unitNumber: units.unitNumber,
			propertyName: properties.name,
			propertyAddress: properties.address,
			tenantName: user.name,
			companyName: ownerProfiles.companyName,
			ownerAddress: ownerProfiles.address,
			gstNumber: ownerProfiles.gstNumber,
			receiptPaymentId: sql<string | null>`(
				select ${payments.id}
				from ${payments}
				where ${payments.utilityId} = ${utilities.id}
					and ${payments.type} = 'utility'
				order by ${payments.createdAt} desc
				limit 1
			)`,
		})
		.from(utilities)
		.innerJoin(leases, eq(utilities.leaseId, leases.id))
		.innerJoin(units, eq(leases.unitId, units.id))
		.innerJoin(properties, eq(units.propertyId, properties.id))
		.innerJoin(user, eq(leases.tenantId, user.id))
		.leftJoin(
			ownerProfiles,
			and(
				eq(ownerProfiles.userId, properties.ownerId),
				isNull(ownerProfiles.deletedAt),
			),
		)
		.where(eq(utilities.id, utilityId))
		.limit(1);

	if (!row) {
		throw new ORPCError("NOT_FOUND", {
			message: "Utility entry not found",
		});
	}

	if (row.ownerId !== userId) {
		throw new ORPCError("FORBIDDEN", {
			message: "You do not own this utility",
		});
	}

	const credits = await db
		.select({
			amount: billCredits.amount,
			reason: billCredits.reason,
			creditNoteNo: billCredits.creditNoteNo,
			type: billCredits.type,
			appliedAs: billCredits.appliedAs,
		})
		.from(billCredits)
		.where(eq(billCredits.utilityId, utilityId))
		.orderBy(billCredits.createdAt);

	const [paidAgg] = await db
		.select({ sum: sql<number>`coalesce(sum(${payments.amount}), 0)` })
		.from(payments)
		.where(eq(payments.utilityId, utilityId));

	const creditsSum = credits.reduce((s, c) => s + c.amount, 0);
	const paidSum = paidAgg?.sum ?? 0;
	const amountDue = row.totalAmount + creditsSum - paidSum;

	return { ...row, credits, amountDue };
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
			throw new ORPCError("FORBIDDEN", {
				message: "you don't own this lease",
			});
		}
		const isMeter = input.utilityType !== UTILITY_TYPES.MAINTENANCE;

		// Business rule: total = (current - previous) * ratePerUnit
		// Always computed server side - never client side
		const unitsUsed = isMeter
			? input.currentReading - input.previousReading
			: null;

		const totalAmount = computeTotalPaisa({
			utilityType: input.utilityType,
			currentReading: input.currentReading,
			previousReading: input.previousReading,
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
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create utility entry",
			});
		}

		await sendAutomaticUtilityBillEmail({
			db,
			ownerId: authUser.id,
			utilityIds: [utility.id],
		});

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

		// GST-safe guard: immutable totalAmount once financial history exists
		const touchesFinancial =
			input.data.utilityType !== undefined ||
			input.data.previousReading !== undefined ||
			input.data.currentReading !== undefined ||
			input.data.ratePerUnit !== undefined ||
			input.data.fixedCharge !== undefined ||
			(input.data as { unitsUsed?: unknown }).unitsUsed !== undefined;
		if (touchesFinancial) {
			const [ownerProfile] = await db
				.select({ gstEnabled: ownerProfiles.gstEnabled })
				.from(ownerProfiles)
				.where(eq(ownerProfiles.userId, authUser.id))
				.limit(1);
			const gstEnabled = ownerProfile?.gstEnabled ?? false;

			// Lock only when a net payment remains — a fully-voided bill (reversal
			// nets to zero) has no real financial history and stays editable.
			const [paid] = await db
				.select({ sum: sql<number>`coalesce(sum(${payments.amount}), 0)` })
				.from(payments)
				.where(eq(payments.utilityId, input.id));
			const hasNetPayment = (paid?.sum ?? 0) > 0;
			const [credit] = await db
				.select({ id: billCredits.id })
				.from(billCredits)
				.where(
					and(
						eq(billCredits.utilityId, input.id),
						isNull(billCredits.reversedAt),
					),
				)
				.limit(1);

			if (gstEnabled || hasNetPayment || credit) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Bill is locked — use a credit note for adjustments. Financial fields cannot be edited after GST is enabled or payments/credits exist.",
				});
			}
		}

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

		const totalAmount = computeTotalPaisa({
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
			throw new ORPCError("NOT_FOUND", {
				message: "Utility not found after update",
			});
		}

		return { utility: updated };
	});

// 3.getById
export const getUtilityById = ownerProcedure
	.route({ method: "GET", path: "/rent/utility/get" })
	.input(z.object({ id: z.string() }))
	.output(z.object({ utility: UtilityBillDataSchema }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		// getOwnedUtility does the find + ownership check
		const row = await getOwnedUtility(db, input.id, authUser.id);

		// Strip the joined ownerId before returning
		const { ownerId: _ownerId, ...utility } = row;
		return { utility: { ...utility, ownerName: authUser.name } };
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

		// Soft-delete aware: hide utilities for deleted properties/units
		const baseFilter = and(
			eq(properties.ownerId, authUser.id),
			isNull(properties.deletedAt),
			isNull(units.deletedAt),
		);
		const whereClause = input.leaseId
			? and(baseFilter, eq(utilities.leaseId, input.leaseId))
			: baseFilter;

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
				// A utility can have historical payment attempts. Select only the
				// latest utility payment so the list remains one row per utility.
				receiptPaymentId: sql<string | null>`(
					select ${payments.id}
					from ${payments}
					where ${payments.utilityId} = ${utilities.id}
						and ${payments.type} = 'utility'
					order by ${payments.createdAt} desc
					limit 1
				)`,
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

		if (results.length === 0) return { utilities: [] as never };

		const utilityIds = results.map((r) => r.id);

		const creditRows = await db
			.select({
				utilityId: billCredits.utilityId,
				amount: billCredits.amount,
				reason: billCredits.reason,
				creditNoteNo: billCredits.creditNoteNo,
				type: billCredits.type,
				appliedAs: billCredits.appliedAs,
			})
			.from(billCredits)
			.where(inArray(billCredits.utilityId, utilityIds))
			.orderBy(billCredits.createdAt);

		const paymentSums = await db
			.select({
				utilityId: payments.utilityId,
				sum: sql<number>`coalesce(sum(${payments.amount}), 0)`,
			})
			.from(payments)
			.where(inArray(payments.utilityId, utilityIds))
			.groupBy(payments.utilityId);

		const creditsByUtility = new Map<string, typeof creditRows>();
		for (const cr of creditRows) {
			if (!cr.utilityId) continue;
			const arr = creditsByUtility.get(cr.utilityId) ?? [];
			arr.push(cr);
			creditsByUtility.set(cr.utilityId, arr);
		}
		const paidByUtility = new Map<string, number>();
		for (const p of paymentSums) {
			if (!p.utilityId) continue;
			paidByUtility.set(p.utilityId, Number(p.sum));
		}

		const enriched = results.map((r) => {
			const credits = (creditsByUtility.get(r.id) ?? []).map((c) => ({
				amount: c.amount,
				reason: c.reason,
				creditNoteNo: c.creditNoteNo,
				type: c.type,
				appliedAs: c.appliedAs,
			}));
			const creditsSum = credits.reduce((s, c) => s + c.amount, 0);
			const paidSum = paidByUtility.get(r.id) ?? 0;
			const amountDue = r.totalAmount + creditsSum - paidSum;
			return { ...r, credits, amountDue };
		});

		return {
			utilities: enriched as never,
		};
	});

// 5. Remove — GST-safe: block delete when financial history exists (mirrors updateUtility guard)
export const removeUtility = ownerProcedure
	.route({ method: "DELETE", path: "/rent/utility/remove" })
	.input(z.object({ id: z.string() }))
	.output(z.object({ success: z.boolean() }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		const existing = await getOwnedUtility(db, input.id, authUser.id);

		// GST-safe guard: keep immutable totalAmount, force credit-note path once history exists
		const [ownerProfile] = await db
			.select({ gstEnabled: ownerProfiles.gstEnabled })
			.from(ownerProfiles)
			.where(eq(ownerProfiles.userId, authUser.id))
			.limit(1);
		const gstEnabled = ownerProfile?.gstEnabled ?? false;
		if (gstEnabled) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Cannot delete a billed utility when GST is enabled — use a credit note instead.",
			});
		}
		const [paid] = await db
			.select({ sum: sql<number>`coalesce(sum(${payments.amount}), 0)` })
			.from(payments)
			.where(eq(payments.utilityId, existing.id));
		if ((paid?.sum ?? 0) > 0) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Cannot delete a utility with recorded payments — use a credit note or void the payment.",
			});
		}
		const [credit] = await db
			.select({ id: billCredits.id })
			.from(billCredits)
			.where(
				and(
					eq(billCredits.utilityId, existing.id),
					isNull(billCredits.reversedAt),
				),
			)
			.limit(1);
		if (credit) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Cannot delete a utility with active credits — reverse the credit first.",
			});
		}

		await db.delete(utilities).where(eq(utilities.id, existing.id));

		return { success: true };
	});

// Per-item schema for a batch. leaseId is stamped by the server from the batch
// request, never trusted from an item — dropping it prevents a mismatched
// per-item lease from silently billing the wrong unit.
const BatchItemSchema = CreateUtilitySchema.omit({ leaseId: true }).extend({
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
			// Reuse the single-bill pricing so batch and single bills charge the
			// same price: maintenance is a fixed charge only, decreasing readings
			// are rejected rather than clamped to zero.
			const totalAmount = computeTotalPaisa({
				utilityType: item.utilityType,
				currentReading: item.currentReading,
				previousReading: item.previousReading,
				ratePerUnit: item.ratePerUnit,
				fixedCharge: item.fixedCharge,
			});
			const unitsUsed =
				item.utilityType === UTILITY_TYPES.MAINTENANCE
					? null
					: (item.currentReading ?? 0) - (item.previousReading ?? 0);

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

		// A single INSERT is atomic on both database drivers. Neon HTTP does not
		// support callback transactions, so avoid wrapping this statement in one.
		const inserted = await db
			.insert(utilities)
			.values(insertValues)
			.returning();

		await sendAutomaticUtilityBillEmail({
			db,
			ownerId: authUser.id,
			batchId: input.batchId,
		});

		return {
			utilities: inserted,
			batchId: input.batchId,
		};
	});

export const recordUtilityPayment = ownerProcedure
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

		let payment: typeof payments.$inferSelect | undefined;
		if (supportsBatch(db)) {
			const due = await getAmountDueForUtility(db, input.utilityId);
			if (due <= 0)
				throw new ORPCError("CONFLICT", { message: "Already paid/discounted" });
			if (input.amount !== due)
				throw new ORPCError("BAD_REQUEST", {
					message: `Payment must match amountDue: ${due}`,
				});

			const [inserted] = await db
				.insert(payments)
				.values({
					leaseId: input.leaseId,
					utilityId: input.utilityId,
					amount: input.amount,
					paymentDate: new Date(input.receivedAt),
					paymentMethods: input.paymentMethod,
					type: "utility",
					description: input.notes ?? null,
					referenceNumber: null,
				})
				.returning();

			await db
				.update(utilities)
				.set({ isPaid: true, updatedAt: new Date() })
				.where(eq(utilities.id, input.utilityId));
			payment = inserted;
		} else {
			[payment] = await db.transaction(async (tx) => {
				await tx.execute(
					sql`select 1 from ${utilities} where ${utilities.id} = ${input.utilityId} for update`,
				);
				const due = await getAmountDueForUtility(tx, input.utilityId);
				if (due <= 0)
					throw new ORPCError("CONFLICT", {
						message: "Already paid/discounted",
					});
				if (input.amount !== due)
					throw new ORPCError("BAD_REQUEST", {
						message: `Payment must match amountDue: ${due}`,
					});

				const inserted = await tx
					.insert(payments)
					.values({
						leaseId: input.leaseId,
						utilityId: input.utilityId,
						amount: input.amount,
						paymentDate: new Date(input.receivedAt),
						paymentMethods: input.paymentMethod,
						type: "utility",
						description: input.notes ?? null,
						referenceNumber: null,
					})
					.returning();

				await tx
					.update(utilities)
					.set({ isPaid: true, updatedAt: new Date() })
					.where(eq(utilities.id, input.utilityId));
				return inserted;
			});
		}

		if (payment) {
			await sendAutomaticPaymentReceipt(db, user.id, payment.id);
		}

		return { success: true };
	});
