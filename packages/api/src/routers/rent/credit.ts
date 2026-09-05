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
	payments,
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

// Drizzle wraps driver errors (the Postgres code nests under cause); read
// both so constraint arbitration works on every path.
function violationCode(error: unknown): string | undefined {
	const top = error as { code?: unknown; cause?: unknown } | null;
	if (typeof top?.code === "string") return top.code;
	const cause = top?.cause as { code?: unknown } | null | undefined;
	if (typeof cause?.code === "string") return cause.code;
	return undefined;
}

async function findReversalByCredit(
	db: Pick<Database, "select">,
	creditId: string,
) {
	const [row] = await db
		.select()
		.from(billCredits)
		.where(eq(billCredits.reversesCreditId, creditId))
		.limit(1);
	return row;
}

async function markCreditReversed(
	db: Pick<Database, "update">,
	creditId: string,
) {
	const [updated] = await db
		.update(billCredits)
		.set({ reversedAt: new Date(), updatedAt: new Date() })
		.where(eq(billCredits.id, creditId))
		.returning();
	return updated;
}

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
	syncUtilityPaidState,
} from "../helpers/credit.helpers";
import { settlementAdvisoryLock } from "../helpers/settlement-lock";

// *********** Helper **********************
const getCreditNoteNo = (id: string) =>
	`KQ-CN-${id.replaceAll("-", "").slice(-12).toUpperCase()}`;

async function insertNeonCredit(
	db: BatchCapableDatabase,
	input: {
		id: string;
		leaseId: string;
		utilityId: string | null;
		ownerId: string;
		type: string;
		amount: number;
		reason: string;
		creditNoteNo: string;
		appliedAs: string;
		createdBy: string;
		idempotencyKey: string;
	},
) {
	const lockQuery = db.execute(
		sql`SELECT ${settlementAdvisoryLock(input.utilityId ? "utility" : "lease", input.utilityId ?? input.leaseId)}`,
	);
	const insertQuery = input.utilityId
		? db.execute<{ id: string }>(sql`
			WITH balance AS MATERIALIZED (
				SELECT u."total_amount"
					+ COALESCE((
						SELECT sum(c."amount")
						FROM ${billCredits} c
						WHERE c."utility_id" = u."id"
					), 0)
					- COALESCE((
						SELECT sum(p."amount")
						FROM ${payments} p
						WHERE p."utility_id" = u."id"
					), 0) AS "amount_due"
				FROM ${utilities} u
				WHERE u."id" = ${input.utilityId}
			), inserted AS (
				INSERT INTO ${billCredits} (
					"id", "lease_id", "utility_id", "owner_id", "type", "amount",
					"reason", "credit_note_no", "applied_as", "created_by",
					"idempotency_key"
				)
				SELECT ${input.id}, ${input.leaseId}, ${input.utilityId},
					${input.ownerId}, ${input.type}, ${input.amount}, ${input.reason},
					${input.creditNoteNo}, ${input.appliedAs}, ${input.createdBy},
					${input.idempotencyKey}
				FROM balance
				WHERE abs(${input.amount}) <= balance."amount_due"
				RETURNING "id", "amount"
			), updated AS (
				UPDATE ${utilities} u
				SET "is_paid" = (
					u."total_amount"
					+ COALESCE((
						SELECT sum(c."amount")
						FROM ${billCredits} c
						WHERE c."utility_id" = u."id"
					), 0)
							+ inserted."amount"
							- COALESCE((
								SELECT sum(p."amount")
								FROM ${payments} p
								WHERE p."utility_id" = u."id"
							), 0) <= 0
				), "updated_at" = now()
				FROM inserted
				WHERE u."id" = ${input.utilityId}
				RETURNING u."id"
			)
			SELECT inserted."id" AS "id"
			FROM inserted
			LEFT JOIN updated ON true
		`)
		: db.execute<{ id: string }>(sql`
			WITH balance AS MATERIALIZED (
				SELECT l."rent"
					+ COALESCE((
						SELECT sum(c."amount")
						FROM ${billCredits} c
						WHERE c."lease_id" = l."id" AND c."utility_id" IS NULL
					), 0)
					- COALESCE((
						SELECT sum(p."amount")
						FROM ${payments} p
						LEFT JOIN ${payments} original_payment
							ON p."type" = 'reversal'
							AND p."reference_number" = original_payment."id"::text
							AND original_payment."lease_id" = p."lease_id"
						WHERE p."lease_id" = l."id"
							AND p."utility_id" IS NULL
							AND (
								p."type" = 'rent'
								OR (p."type" = 'reversal' AND original_payment."type" = 'rent')
							)
					), 0) AS "amount_due"
				FROM ${leases} l
				WHERE l."id" = ${input.leaseId}
			), inserted AS (
				INSERT INTO ${billCredits} (
					"id", "lease_id", "utility_id", "owner_id", "type", "amount",
					"reason", "credit_note_no", "applied_as", "created_by",
					"idempotency_key"
				)
				SELECT ${input.id}, ${input.leaseId}, NULL, ${input.ownerId},
					${input.type}, ${input.amount}, ${input.reason}, ${input.creditNoteNo},
					${input.appliedAs}, ${input.createdBy}, ${input.idempotencyKey}
				FROM balance
				WHERE abs(${input.amount}) <= balance."amount_due"
				RETURNING "id", "amount"
			)
			SELECT inserted."id" AS "id" FROM inserted
			`);

	const [, result] = await db.batch([lockQuery, insertQuery]);
	return result.rows[0]?.id;
}

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
			idempotencyKey: z.uuid(),
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
			const idempotencyKey = input.idempotencyKey ?? null;
			if (idempotencyKey) {
				const [existing] = await db
					.select()
					.from(billCredits)
					.where(
						and(
							eq(billCredits.leaseId, input.leaseId),
							eq(billCredits.idempotencyKey, idempotencyKey),
						),
					)
					.limit(1);
				if (existing) return { credit: existing };
			}

			const id = generatedId();
			const creditNoteNo = getCreditNoteNo(id);

			let row: typeof billCredits.$inferSelect | undefined;
			let insertedId: string | undefined;
			try {
				insertedId = await insertNeonCredit(db, {
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
					idempotencyKey,
				});
			} catch (error) {
				if (violationCode(error) !== "23505") throw error;
			}
			if (!insertedId && idempotencyKey) {
				const [existing] = await db
					.select()
					.from(billCredits)
					.where(
						and(
							eq(billCredits.leaseId, input.leaseId),
							eq(billCredits.idempotencyKey, idempotencyKey),
						),
					)
					.limit(1);
				if (existing) return { credit: existing };
			}
			if (insertedId) {
				[row] = await db
					.select()
					.from(billCredits)
					.where(eq(billCredits.id, insertedId))
					.limit(1);
			}
			if (!row) {
				const due = input.utilityId
					? await getAmountDueForUtility(db, input.utilityId)
					: await getAmountDueForRent(db, input.leaseId);
				throw new ORPCError("BAD_REQUEST", {
					message: `Discount exceeds amountDue: ${due}`,
				});
			}
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

			const idempotencyKey = input.idempotencyKey ?? null;
			if (idempotencyKey) {
				const [existing] = await tx
					.select()
					.from(billCredits)
					.where(
						and(
							eq(billCredits.leaseId, input.leaseId),
							eq(billCredits.idempotencyKey, idempotencyKey),
						),
					)
					.limit(1);
				if (existing) return { credit: existing };
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
					idempotencyKey,
				})
				.returning();
			if (input.utilityId) {
				await syncUtilityPaidState(tx, input.utilityId);
			}
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

		if (existing.reversedAt) {
			const retry = await findReversalByCredit(db, existing.id);
			if (retry) return { credit: existing, reversal: retry };
			throw new ORPCError("CONFLICT", { message: "Already reversed" });
		}

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

			let reversal: typeof billCredits.$inferSelect | undefined;
			try {
				const [reversalRow] = await db
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
				reversal = reversalRow;
			} catch (error) {
				// Concurrent winner (or a crashed batch's orphan row): adopt it
				// instead of duplicating, then complete the original below.
				if (violationCode(error) !== "23505") throw error;
				const winner = await findReversalByCredit(db, existing.id);
				if (!winner) throw error;
				reversal = winner;
			}

			if (!reversal) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to reverse credit",
				});
			}

			const updated = await markCreditReversed(db, existing.id);

			if (existing.utilityId) {
				await syncUtilityPaidState(db, existing.utilityId);
			}

			return { credit: updated, reversal };
		}

		try {
			return await db.transaction(async (tx) => {
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

				if (!reversal) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Failed to reverse credit",
					});
				}

				const updated = await markCreditReversed(tx, existing.id);

				if (existing.utilityId) {
					await syncUtilityPaidState(tx, existing.utilityId);
				}

				return { credit: updated, reversal };
			});
		} catch (error) {
			// The aborted transaction cannot be reused — adopt the winner and
			// complete the original outside of it.
			if (violationCode(error) !== "23505") throw error;
			const winner = await findReversalByCredit(db, existing.id);
			if (!winner) throw error;
			const updated = await markCreditReversed(db, existing.id);
			if (existing.utilityId) {
				await syncUtilityPaidState(db, existing.utilityId);
			}
			return { credit: updated, reversal: winner };
		}
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
