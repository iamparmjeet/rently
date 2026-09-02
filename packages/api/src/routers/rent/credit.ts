import { ORPCError } from "@orpc/server";
import { ownerProcedure } from "@rently/api/procedures";
import { StatusCode } from "@rently/api/utils";
import type { Database } from "@rently/db";
import {
	APPLIED_AS_VALUES,
	CREDIT_TYPE_VALUES,
} from "@rently/db/constants/payment-constants";
import { user } from "@rently/db/schema/auth";
import {
	billCredits,
	leases,
	ownerProfiles,
	properties,
	units,
	utilities,
} from "@rently/db/schema/schema";
import { generatedId } from "@rently/db/utils/id";
import { CreditNoteDataSchema } from "@rently/validators";
import { and, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import z from "zod";
import { isLeaseOwner } from "../helpers";

type BatchCapableDatabase = Database & {
	batch<T extends readonly unknown[]>(
		queries: T,
	): Promise<{ [K in keyof T]: Awaited<T[K]> }>;
};

function supportsBatch(db: Database): db is BatchCapableDatabase {
	return typeof (db as { batch?: unknown }).batch === "function";
}

import {
	getAmountDueForRent,
	getAmountDueForUtility,
} from "../helpers/credit.helpers";

// *********** Helper **********************
const getCreditNoteNo = (id: string) =>
	`KQ-CN-${id.replaceAll("-", "").slice(-12).toUpperCase()}`;

// *********** Helper Ends **********************

// 1) Create Credit
export const createCredit = ownerProcedure
	.route({
		method: "POST",
		path: "/rent/credit/create",
		successStatus: StatusCode.CREATED,
	})
	.input(
		z.object({
			leaseId: z.uuid(),
			utilityId: z.uuid().nullable().optional(), // null = rent/general
			type: z.enum(CREDIT_TYPE_VALUES),
			amount: z
				.number()
				.int()
				.negative({ error: "Amount must be negative (paise)" }),
			reason: z.string().min(10, { error: "Reason >= 10 chars" }).trim(),
			appliedAs: z.enum(APPLIED_AS_VALUES).default("adjust"),
		}),
	)
	.handler(async ({ context, input }) => {
		const { db, user } = context;
		if (!(await isLeaseOwner(db, user.id, input.leaseId)))
			throw new ORPCError("FORBIDDEN");

		if (input.utilityId) {
			const [u] = await db
				.select({ leaseId: utilities.leaseId })
				.from(utilities)
				.where(eq(utilities.id, input.utilityId))
				.limit(1);
			if (!u || u.leaseId !== input.leaseId)
				throw new ORPCError("FORBIDDEN", {
					message: "Utility does not belong to lease",
				});
		}

		if (supportsBatch(db)) {
			// Neon HTTP: no FOR UPDATE / no interactive transaction — validate then
			// single insert is atomic via single statement; concurrency race is
			// acceptable over 500 on Workers.
			const due = input.utilityId
				? await getAmountDueForUtility(db, input.utilityId)
				: await getAmountDueForRent(db, input.leaseId);

			if (Math.abs(input.amount) > due)
				throw new ORPCError("BAD_REQUEST", {
					message: `Discount exceeds amountDue: ${due}`,
				});

			const id = generatedId();
			const creditNoteNo = getCreditNoteNo(id);

			const [row] = await db
				.insert(billCredits)
				.values({
					id,
					leaseId: input.leaseId,
					utilityId: input.utilityId ?? null,
					ownerId: user.id,
					type: input.type,
					amount: input.amount,
					reason: input.reason,
					creditNoteNo,
					appliedAs: input.appliedAs,
					createdBy: user.id,
				})
				.returning();
			return { credit: row };
		}

		return db.transaction(async (tx) => {
			if (input.utilityId) {
				await tx.execute(
					sql`select 1 from ${utilities} where ${utilities.id} = ${input.utilityId} for update`,
				);
			} else {
				await tx.execute(
					sql`select 1 from ${leases} where ${leases.id} = ${input.leaseId} for update`,
				);
			}

			const due = input.utilityId
				? await getAmountDueForUtility(tx, input.utilityId)
				: await getAmountDueForRent(tx, input.leaseId);

			if (Math.abs(input.amount) > due)
				throw new ORPCError("BAD_REQUEST", {
					message: `Discount exceeds amountDue: ${due}`,
				});

			const id = generatedId();
			const creditNoteNo = getCreditNoteNo(id);

			const [row] = await tx
				.insert(billCredits)
				.values({
					id,
					leaseId: input.leaseId,
					utilityId: input.utilityId ?? null,
					ownerId: user.id,
					type: input.type,
					amount: input.amount,
					reason: input.reason,
					creditNoteNo,
					appliedAs: input.appliedAs,
					createdBy: user.id,
				})
				.returning();
			return { credit: row };
		});
	});

// 2) Reverse Credit — never delete, insert +abs reversal with reversesCreditId + set reversedAt on original
export const reverseCredit = ownerProcedure
	.route({
		method: "POST",
		path: "/rent/credit/reverse",
	})
	.input(z.object({ creditId: z.uuid() }))
	.handler(async ({ context, input }) => {
		const { db, user } = context;
		const [existing] = await db
			.select()
			.from(billCredits)
			.where(eq(billCredits.id, input.creditId))
			.limit(1);

		if (!existing) throw new ORPCError("NOT_FOUND");

		if (!(await isLeaseOwner(db, user.id, existing.leaseId)))
			throw new ORPCError("FORBIDDEN");

		if (existing.reversedAt)
			throw new ORPCError("CONFLICT", { message: "Already reversed" });

		// Guard: only negative credits can be reversed (positive are already reversals)
		if (existing.amount >= 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Only discount/write-off credits can be reversed",
			});
		}

		if (supportsBatch(db)) {
			const reversalAmount = Math.abs(existing.amount);
			const reversalId = generatedId();
			const reversalNoteNo = getCreditNoteNo(reversalId);

			const [reversal] = await db
				.insert(billCredits)
				.values({
					id: reversalId,
					leaseId: existing.leaseId,
					utilityId: existing.utilityId,
					ownerId: user.id,
					type: existing.type,
					amount: reversalAmount,
					reason:
						`Reversal of ${existing.creditNoteNo}: ${existing.reason}`.slice(
							0,
							500,
						),
					creditNoteNo: reversalNoteNo,
					appliedAs: existing.appliedAs,
					reversesCreditId: existing.id,
					createdBy: user.id,
				})
				.returning();

			const [updated] = await db
				.update(billCredits)
				.set({
					reversedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(billCredits.id, input.creditId))
				.returning();

			return { credit: updated, reversal };
		}

		return db.transaction(async (tx) => {
			const reversalAmount = Math.abs(existing.amount);
			const reversalId = generatedId();
			const reversalNoteNo = getCreditNoteNo(reversalId);

			const [reversal] = await tx
				.insert(billCredits)
				.values({
					id: reversalId,
					leaseId: existing.leaseId,
					utilityId: existing.utilityId,
					ownerId: user.id,
					type: existing.type,
					amount: reversalAmount,
					reason:
						`Reversal of ${existing.creditNoteNo}: ${existing.reason}`.slice(
							0,
							500,
						),
					creditNoteNo: reversalNoteNo,
					appliedAs: existing.appliedAs,
					reversesCreditId: existing.id,
					createdBy: user.id,
				})
				.returning();

			const [updated] = await tx
				.update(billCredits)
				.set({
					reversedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(billCredits.id, input.creditId))
				.returning();

			return { credit: updated, reversal };
		});
	});

// 3) List Credits
export const listCredits = ownerProcedure
	.route({
		method: "GET",
		path: "/rent/credit/list",
	})
	.input(
		z.object({
			leaseId: z.uuid().optional(),
			utilityId: z.uuid().nullable().optional(),
		}),
	)
	.handler(async ({ context, input }) => {
		const { db, user } = context;
		const filters = [eq(billCredits.ownerId, user.id)];
		if (input.leaseId) filters.push(eq(billCredits.leaseId, input.leaseId));
		if (input.utilityId !== undefined) {
			filters.push(
				input.utilityId
					? eq(billCredits.utilityId, input.utilityId)
					: isNull(billCredits.utilityId),
			);
		}
		const credits = await db
			.select()
			.from(billCredits)
			.where(and(...filters))
			.orderBy(sql`${billCredits.createdAt} desc`);

		return { credits };
	});

// 4) Get Credit Note (for PDF)
const tenantUser = alias(user, "credit_tenant");
export const getCreditNote = ownerProcedure
	.route({ method: "GET", path: "/rent/credit/get" })
	.input(z.object({ creditId: z.uuid() }))
	.output(z.object({ creditNote: CreditNoteDataSchema }))
	.handler(async ({ context, input }) => {
		const { db, user: authUser } = context;

		const [row] = await db
			.select({
				creditId: billCredits.id,
				creditNoteNo: billCredits.creditNoteNo,
				creditType: billCredits.type,
				creditAmount: billCredits.amount,
				creditReason: billCredits.reason,
				creditAppliedAs: billCredits.appliedAs,
				creditCreatedAt: billCredits.createdAt,
				creditReversedAt: billCredits.reversedAt,
				leaseId: leases.id,
				leaseRent: leases.rent,
				utilityId: utilities.id,
				utilityType: utilities.utilityType,
				utilityTotalAmount: utilities.totalAmount,
				utilityPreviousReading: utilities.previousReading,
				utilityCurrentReading: utilities.currentReading,
				utilityRatePerUnit: utilities.ratePerUnit,
				utilityFixedCharge: utilities.fixedCharge,
				utilityCurrentReadingDate: utilities.currentReadingDate,
				utilityPreviousReadingDate: utilities.previousReadingDate,
				propertyName: properties.name,
				propertyAddress: properties.address,
				unitNumber: units.unitNumber,
				tenantName: tenantUser.name,
				ownerName: user.name,
				ownerCompanyName: ownerProfiles.companyName,
				ownerAddress: ownerProfiles.address,
				ownerGstNumber: ownerProfiles.gstNumber,
				ownerGstEnabled: ownerProfiles.gstEnabled,
				ownerGstRateRent: ownerProfiles.gstRateRent,
				ownerGstRateMaintenance: ownerProfiles.gstRateMaintenance,
				ownerId: properties.ownerId,
			})
			.from(billCredits)
			.innerJoin(leases, eq(billCredits.leaseId, leases.id))
			.innerJoin(units, eq(leases.unitId, units.id))
			.innerJoin(properties, eq(units.propertyId, properties.id))
			.innerJoin(user, eq(properties.ownerId, user.id))
			.innerJoin(tenantUser, eq(leases.tenantId, tenantUser.id))
			.leftJoin(utilities, eq(billCredits.utilityId, utilities.id))
			.leftJoin(
				ownerProfiles,
				and(
					eq(ownerProfiles.userId, properties.ownerId),
					isNull(ownerProfiles.deletedAt),
				),
			)
			.where(eq(billCredits.id, input.creditId))
			.limit(1);

		if (!row)
			throw new ORPCError("NOT_FOUND", { message: "Credit note not found" });
		if (row.ownerId !== authUser.id)
			throw new ORPCError("FORBIDDEN", {
				message: "You do not own this credit",
			});

		return {
			creditNote: {
				credit: {
					id: row.creditId,
					creditNoteNo: row.creditNoteNo,
					type: row.creditType,
					amount: row.creditAmount,
					reason: row.creditReason,
					appliedAs: row.creditAppliedAs,
					createdAt: row.creditCreatedAt ?? new Date(),
					reversedAt: row.creditReversedAt,
				},
				utility: row.utilityId
					? {
							id: row.utilityId,
							utilityType: row.utilityType ?? "unknown",
							totalAmount: row.utilityTotalAmount ?? 0,
							previousReading: row.utilityPreviousReading,
							currentReading: row.utilityCurrentReading,
							ratePerUnit: row.utilityRatePerUnit,
							fixedCharge: row.utilityFixedCharge,
							currentReadingDate: row.utilityCurrentReadingDate ?? new Date(),
							previousReadingDate: row.utilityPreviousReadingDate,
						}
					: null,
				lease: { id: row.leaseId, rent: row.leaseRent },
				property: { name: row.propertyName, address: row.propertyAddress },
				unit: { unitNumber: row.unitNumber },
				tenant: { name: row.tenantName },
				owner: {
					name: row.ownerName,
					companyName: row.ownerCompanyName,
					address: row.ownerAddress,
					gstNumber: row.ownerGstNumber,
					gstEnabled: row.ownerGstEnabled ?? false,
					gstRateRent: row.ownerGstRateRent,
					gstRateMaintenance: row.ownerGstRateMaintenance,
				},
			},
		};
	});
